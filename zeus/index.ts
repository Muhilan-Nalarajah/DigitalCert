/* eslint-disable */

import { AllTypesProps, ReturnTypes, Ops } from './const';


export const HOST="Specify host"


export const HEADERS = {}
export const apiSubscription = (options: chainOptions) => (query: string) => {
  try {
    const queryString = options[0] + '?query=' + encodeURIComponent(query);
    const wsString = queryString.replace('http', 'ws');
    const host = (options.length > 1 && options[1]?.websocket?.[0]) || wsString;
    const webSocketOptions = options[1]?.websocket || [host];
    const ws = new WebSocket(...webSocketOptions);
    return {
      ws,
      on: (e: (args: any) => void) => {
        ws.onmessage = (event: any) => {
          if (event.data) {
            const parsed = JSON.parse(event.data);
            const data = parsed.data;
            return e(data);
          }
        };
      },
      off: (e: (args: any) => void) => {
        ws.onclose = e;
      },
      error: (e: (args: any) => void) => {
        ws.onerror = e;
      },
      open: (e: () => void) => {
        ws.onopen = e;
      },
    };
  } catch {
    throw new Error('No websockets implemented');
  }
};
const handleFetchResponse = (response: Response): Promise<GraphQLResponse> => {
  if (!response.ok) {
    return new Promise((_, reject) => {
      response
        .text()
        .then((text) => {
          try {
            reject(JSON.parse(text));
          } catch (err) {
            reject(text);
          }
        })
        .catch(reject);
    });
  }
  return response.json() as Promise<GraphQLResponse>;
};

export const apiFetch =
  (options: fetchOptions) =>
  (query: string, variables: Record<string, unknown> = {}) => {
    const fetchOptions = options[1] || {};
    if (fetchOptions.method && fetchOptions.method === 'GET') {
      return fetch(`${options[0]}?query=${encodeURIComponent(query)}`, fetchOptions)
        .then(handleFetchResponse)
        .then((response: GraphQLResponse) => {
          if (response.errors) {
            throw new GraphQLError(response);
          }
          return response.data;
        });
    }
    return fetch(`${options[0]}`, {
      body: JSON.stringify({ query, variables }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      ...fetchOptions,
    })
      .then(handleFetchResponse)
      .then((response: GraphQLResponse) => {
        if (response.errors) {
          throw new GraphQLError(response);
        }
        return response.data;
      });
  };

export const InternalsBuildQuery = ({
  ops,
  props,
  returns,
  options,
  scalars,
}: {
  props: AllTypesPropsType;
  returns: ReturnTypesType;
  ops: Operations;
  options?: OperationOptions;
  scalars?: ScalarDefinition;
}) => {
  const ibb = (
    k: string,
    o: InputValueType | VType,
    p = '',
    root = true,
    vars: Array<{ name: string; graphQLType: string }> = [],
  ): string => {
    const keyForPath = purifyGraphQLKey(k);
    const newPath = [p, keyForPath].join(SEPARATOR);
    if (!o) {
      return '';
    }
    if (typeof o === 'boolean' || typeof o === 'number') {
      return k;
    }
    if (typeof o === 'string') {
      return `${k} ${o}`;
    }
    if (Array.isArray(o)) {
      const args = InternalArgsBuilt({
        props,
        returns,
        ops,
        scalars,
        vars,
      })(o[0], newPath);
      return `${ibb(args ? `${k}(${args})` : k, o[1], p, false, vars)}`;
    }
    if (k === '__alias') {
      return Object.entries(o)
        .map(([alias, objectUnderAlias]) => {
          if (typeof objectUnderAlias !== 'object' || Array.isArray(objectUnderAlias)) {
            throw new Error(
              'Invalid alias it should be __alias:{ YOUR_ALIAS_NAME: { OPERATION_NAME: { ...selectors }}}',
            );
          }
          const operationName = Object.keys(objectUnderAlias)[0];
          const operation = objectUnderAlias[operationName];
          return ibb(`${alias}:${operationName}`, operation, p, false, vars);
        })
        .join('\n');
    }
    const hasOperationName = root && options?.operationName ? ' ' + options.operationName : '';
    const keyForDirectives = o.__directives ?? '';
    const query = `{${Object.entries(o)
      .filter(([k]) => k !== '__directives')
      .map((e) => ibb(...e, [p, `field<>${keyForPath}`].join(SEPARATOR), false, vars))
      .join('\n')}}`;
    if (!root) {
      return `${k} ${keyForDirectives}${hasOperationName} ${query}`;
    }
    const varsString = vars.map((v) => `${v.name}: ${v.graphQLType}`).join(', ');
    return `${k} ${keyForDirectives}${hasOperationName}${varsString ? `(${varsString})` : ''} ${query}`;
  };
  return ibb;
};

export const Thunder =
  (fn: FetchFunction) =>
  <O extends keyof typeof Ops, SCLR extends ScalarDefinition, R extends keyof ValueTypes = GenericOperation<O>>(
    operation: O,
    graphqlOptions?: ThunderGraphQLOptions<SCLR>,
  ) =>
  <Z extends ValueTypes[R]>(o: Z | ValueTypes[R], ops?: OperationOptions & { variables?: Record<string, unknown> }) =>
    fn(
      Zeus(operation, o, {
        operationOptions: ops,
        scalars: graphqlOptions?.scalars,
      }),
      ops?.variables,
    ).then((data) => {
      if (graphqlOptions?.scalars) {
        return decodeScalarsInResponse({
          response: data,
          initialOp: operation,
          initialZeusQuery: o as VType,
          returns: ReturnTypes,
          scalars: graphqlOptions.scalars,
          ops: Ops,
        });
      }
      return data;
    }) as Promise<InputType<GraphQLTypes[R], Z, SCLR>>;

export const Chain = (...options: chainOptions) => Thunder(apiFetch(options));

export const SubscriptionThunder =
  (fn: SubscriptionFunction) =>
  <O extends keyof typeof Ops, SCLR extends ScalarDefinition, R extends keyof ValueTypes = GenericOperation<O>>(
    operation: O,
    graphqlOptions?: ThunderGraphQLOptions<SCLR>,
  ) =>
  <Z extends ValueTypes[R]>(o: Z | ValueTypes[R], ops?: OperationOptions & { variables?: ExtractVariables<Z> }) => {
    const returnedFunction = fn(
      Zeus(operation, o, {
        operationOptions: ops,
        scalars: graphqlOptions?.scalars,
      }),
    ) as SubscriptionToGraphQL<Z, GraphQLTypes[R], SCLR>;
    if (returnedFunction?.on && graphqlOptions?.scalars) {
      const wrapped = returnedFunction.on;
      returnedFunction.on = (fnToCall: (args: InputType<GraphQLTypes[R], Z, SCLR>) => void) =>
        wrapped((data: InputType<GraphQLTypes[R], Z, SCLR>) => {
          if (graphqlOptions?.scalars) {
            return fnToCall(
              decodeScalarsInResponse({
                response: data,
                initialOp: operation,
                initialZeusQuery: o as VType,
                returns: ReturnTypes,
                scalars: graphqlOptions.scalars,
                ops: Ops,
              }),
            );
          }
          return fnToCall(data);
        });
    }
    return returnedFunction;
  };

export const Subscription = (...options: chainOptions) => SubscriptionThunder(apiSubscription(options));
export const Zeus = <
  Z extends ValueTypes[R],
  O extends keyof typeof Ops,
  R extends keyof ValueTypes = GenericOperation<O>,
>(
  operation: O,
  o: Z | ValueTypes[R],
  ops?: {
    operationOptions?: OperationOptions;
    scalars?: ScalarDefinition;
  },
) =>
  InternalsBuildQuery({
    props: AllTypesProps,
    returns: ReturnTypes,
    ops: Ops,
    options: ops?.operationOptions,
    scalars: ops?.scalars,
  })(operation, o as VType);

export const ZeusSelect = <T>() => ((t: unknown) => t) as SelectionFunction<T>;

export const Selector = <T extends keyof ValueTypes>(key: T) => key && ZeusSelect<ValueTypes[T]>();

export const TypeFromSelector = <T extends keyof ValueTypes>(key: T) => key && ZeusSelect<ValueTypes[T]>();
export const Gql = Chain(HOST, {
  headers: {
    'Content-Type': 'application/json',
    ...HEADERS,
  },
});

export const ZeusScalars = ZeusSelect<ScalarCoders>();

export const decodeScalarsInResponse = <O extends Operations>({
  response,
  scalars,
  returns,
  ops,
  initialZeusQuery,
  initialOp,
}: {
  ops: O;
  response: any;
  returns: ReturnTypesType;
  scalars?: Record<string, ScalarResolver | undefined>;
  initialOp: keyof O;
  initialZeusQuery: InputValueType | VType;
}) => {
  if (!scalars) {
    return response;
  }
  const builder = PrepareScalarPaths({
    ops,
    returns,
  });

  const scalarPaths = builder(initialOp as string, ops[initialOp], initialZeusQuery);
  if (scalarPaths) {
    const r = traverseResponse({ scalarPaths, resolvers: scalars })(initialOp as string, response, [ops[initialOp]]);
    return r;
  }
  return response;
};

export const traverseResponse = ({
  resolvers,
  scalarPaths,
}: {
  scalarPaths: { [x: string]: `scalar.${string}` };
  resolvers: {
    [x: string]: ScalarResolver | undefined;
  };
}) => {
  const ibb = (k: string, o: InputValueType | VType, p: string[] = []): unknown => {
    if (Array.isArray(o)) {
      return o.map((eachO) => ibb(k, eachO, p));
    }
    if (o == null) {
      return o;
    }
    const scalarPathString = p.join(SEPARATOR);
    const currentScalarString = scalarPaths[scalarPathString];
    if (currentScalarString) {
      const currentDecoder = resolvers[currentScalarString.split('.')[1]]?.decode;
      if (currentDecoder) {
        return currentDecoder(o);
      }
    }
    if (typeof o === 'boolean' || typeof o === 'number' || typeof o === 'string' || !o) {
      return o;
    }
    const entries = Object.entries(o).map(([k, v]) => [k, ibb(k, v, [...p, purifyGraphQLKey(k)])] as const);
    const objectFromEntries = entries.reduce<Record<string, unknown>>((a, [k, v]) => {
      a[k] = v;
      return a;
    }, {});
    return objectFromEntries;
  };
  return ibb;
};

export type AllTypesPropsType = {
  [x: string]:
    | undefined
    | `scalar.${string}`
    | 'enum'
    | {
        [x: string]:
          | undefined
          | string
          | {
              [x: string]: string | undefined;
            };
      };
};

export type ReturnTypesType = {
  [x: string]:
    | {
        [x: string]: string | undefined;
      }
    | `scalar.${string}`
    | undefined;
};
export type InputValueType = {
  [x: string]: undefined | boolean | string | number | [any, undefined | boolean | InputValueType] | InputValueType;
};
export type VType =
  | undefined
  | boolean
  | string
  | number
  | [any, undefined | boolean | InputValueType]
  | InputValueType;

export type PlainType = boolean | number | string | null | undefined;
export type ZeusArgsType =
  | PlainType
  | {
      [x: string]: ZeusArgsType;
    }
  | Array<ZeusArgsType>;

export type Operations = Record<string, string>;

export type VariableDefinition = {
  [x: string]: unknown;
};

export const SEPARATOR = '|';

export type fetchOptions = Parameters<typeof fetch>;
type websocketOptions = typeof WebSocket extends new (...args: infer R) => WebSocket ? R : never;
export type chainOptions = [fetchOptions[0], fetchOptions[1] & { websocket?: websocketOptions }] | [fetchOptions[0]];
export type FetchFunction = (query: string, variables?: Record<string, unknown>) => Promise<any>;
export type SubscriptionFunction = (query: string) => any;
type NotUndefined<T> = T extends undefined ? never : T;
export type ResolverType<F> = NotUndefined<F extends [infer ARGS, any] ? ARGS : undefined>;

export type OperationOptions = {
  operationName?: string;
};

export type ScalarCoder = Record<string, (s: unknown) => string>;

export interface GraphQLResponse {
  data?: Record<string, any>;
  errors?: Array<{
    message: string;
  }>;
}
export class GraphQLError extends Error {
  constructor(public response: GraphQLResponse) {
    super('');
    console.error(response);
  }
  toString() {
    return 'GraphQL Response Error';
  }
}
export type GenericOperation<O> = O extends keyof typeof Ops ? typeof Ops[O] : never;
export type ThunderGraphQLOptions<SCLR extends ScalarDefinition> = {
  scalars?: SCLR | ScalarCoders;
};

const ExtractScalar = (mappedParts: string[], returns: ReturnTypesType): `scalar.${string}` | undefined => {
  if (mappedParts.length === 0) {
    return;
  }
  const oKey = mappedParts[0];
  const returnP1 = returns[oKey];
  if (typeof returnP1 === 'object') {
    const returnP2 = returnP1[mappedParts[1]];
    if (returnP2) {
      return ExtractScalar([returnP2, ...mappedParts.slice(2)], returns);
    }
    return undefined;
  }
  return returnP1 as `scalar.${string}` | undefined;
};

export const PrepareScalarPaths = ({ ops, returns }: { returns: ReturnTypesType; ops: Operations }) => {
  const ibb = (
    k: string,
    originalKey: string,
    o: InputValueType | VType,
    p: string[] = [],
    pOriginals: string[] = [],
    root = true,
  ): { [x: string]: `scalar.${string}` } | undefined => {
    if (!o) {
      return;
    }
    if (typeof o === 'boolean' || typeof o === 'number' || typeof o === 'string') {
      const extractionArray = [...pOriginals, originalKey];
      const isScalar = ExtractScalar(extractionArray, returns);
      if (isScalar?.startsWith('scalar')) {
        const partOfTree = {
          [[...p, k].join(SEPARATOR)]: isScalar,
        };
        return partOfTree;
      }
      return {};
    }
    if (Array.isArray(o)) {
      return ibb(k, k, o[1], p, pOriginals, false);
    }
    if (k === '__alias') {
      return Object.entries(o)
        .map(([alias, objectUnderAlias]) => {
          if (typeof objectUnderAlias !== 'object' || Array.isArray(objectUnderAlias)) {
            throw new Error(
              'Invalid alias it should be __alias:{ YOUR_ALIAS_NAME: { OPERATION_NAME: { ...selectors }}}',
            );
          }
          const operationName = Object.keys(objectUnderAlias)[0];
          const operation = objectUnderAlias[operationName];
          return ibb(alias, operationName, operation, p, pOriginals, false);
        })
        .reduce((a, b) => ({
          ...a,
          ...b,
        }));
    }
    const keyName = root ? ops[k] : k;
    return Object.entries(o)
      .filter(([k]) => k !== '__directives')
      .map(([k, v]) => {
        // Inline fragments shouldn't be added to the path as they aren't a field
        const isInlineFragment = originalKey.match(/^...\s*on/) != null;
        return ibb(
          k,
          k,
          v,
          isInlineFragment ? p : [...p, purifyGraphQLKey(keyName || k)],
          isInlineFragment ? pOriginals : [...pOriginals, purifyGraphQLKey(originalKey)],
          false,
        );
      })
      .reduce((a, b) => ({
        ...a,
        ...b,
      }));
  };
  return ibb;
};

export const purifyGraphQLKey = (k: string) => k.replace(/\([^)]*\)/g, '').replace(/^[^:]*\:/g, '');

const mapPart = (p: string) => {
  const [isArg, isField] = p.split('<>');
  if (isField) {
    return {
      v: isField,
      __type: 'field',
    } as const;
  }
  return {
    v: isArg,
    __type: 'arg',
  } as const;
};

type Part = ReturnType<typeof mapPart>;

export const ResolveFromPath = (props: AllTypesPropsType, returns: ReturnTypesType, ops: Operations) => {
  const ResolvePropsType = (mappedParts: Part[]) => {
    const oKey = ops[mappedParts[0].v];
    const propsP1 = oKey ? props[oKey] : props[mappedParts[0].v];
    if (propsP1 === 'enum' && mappedParts.length === 1) {
      return 'enum';
    }
    if (typeof propsP1 === 'string' && propsP1.startsWith('scalar.') && mappedParts.length === 1) {
      return propsP1;
    }
    if (typeof propsP1 === 'object') {
      if (mappedParts.length < 2) {
        return 'not';
      }
      const propsP2 = propsP1[mappedParts[1].v];
      if (typeof propsP2 === 'string') {
        return rpp(
          `${propsP2}${SEPARATOR}${mappedParts
            .slice(2)
            .map((mp) => mp.v)
            .join(SEPARATOR)}`,
        );
      }
      if (typeof propsP2 === 'object') {
        if (mappedParts.length < 3) {
          return 'not';
        }
        const propsP3 = propsP2[mappedParts[2].v];
        if (propsP3 && mappedParts[2].__type === 'arg') {
          return rpp(
            `${propsP3}${SEPARATOR}${mappedParts
              .slice(3)
              .map((mp) => mp.v)
              .join(SEPARATOR)}`,
          );
        }
      }
    }
  };
  const ResolveReturnType = (mappedParts: Part[]) => {
    if (mappedParts.length === 0) {
      return 'not';
    }
    const oKey = ops[mappedParts[0].v];
    const returnP1 = oKey ? returns[oKey] : returns[mappedParts[0].v];
    if (typeof returnP1 === 'object') {
      if (mappedParts.length < 2) return 'not';
      const returnP2 = returnP1[mappedParts[1].v];
      if (returnP2) {
        return rpp(
          `${returnP2}${SEPARATOR}${mappedParts
            .slice(2)
            .map((mp) => mp.v)
            .join(SEPARATOR)}`,
        );
      }
    }
  };
  const rpp = (path: string): 'enum' | 'not' | `scalar.${string}` => {
    const parts = path.split(SEPARATOR).filter((l) => l.length > 0);
    const mappedParts = parts.map(mapPart);
    const propsP1 = ResolvePropsType(mappedParts);
    if (propsP1) {
      return propsP1;
    }
    const returnP1 = ResolveReturnType(mappedParts);
    if (returnP1) {
      return returnP1;
    }
    return 'not';
  };
  return rpp;
};

export const InternalArgsBuilt = ({
  props,
  ops,
  returns,
  scalars,
  vars,
}: {
  props: AllTypesPropsType;
  returns: ReturnTypesType;
  ops: Operations;
  scalars?: ScalarDefinition;
  vars: Array<{ name: string; graphQLType: string }>;
}) => {
  const arb = (a: ZeusArgsType, p = '', root = true): string => {
    if (typeof a === 'string') {
      if (a.startsWith(START_VAR_NAME)) {
        const [varName, graphQLType] = a.replace(START_VAR_NAME, '$').split(GRAPHQL_TYPE_SEPARATOR);
        const v = vars.find((v) => v.name === varName);
        if (!v) {
          vars.push({
            name: varName,
            graphQLType,
          });
        } else {
          if (v.graphQLType !== graphQLType) {
            throw new Error(
              `Invalid variable exists with two different GraphQL Types, "${v.graphQLType}" and ${graphQLType}`,
            );
          }
        }
        return varName;
      }
    }
    const checkType = ResolveFromPath(props, returns, ops)(p);
    if (checkType.startsWith('scalar.')) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [_, ...splittedScalar] = checkType.split('.');
      const scalarKey = splittedScalar.join('.');
      return (scalars?.[scalarKey]?.encode?.(a) as string) || JSON.stringify(a);
    }
    if (Array.isArray(a)) {
      return `[${a.map((arr) => arb(arr, p, false)).join(', ')}]`;
    }
    if (typeof a === 'string') {
      if (checkType === 'enum') {
        return a;
      }
      return `${JSON.stringify(a)}`;
    }
    if (typeof a === 'object') {
      if (a === null) {
        return `null`;
      }
      const returnedObjectString = Object.entries(a)
        .filter(([, v]) => typeof v !== 'undefined')
        .map(([k, v]) => `${k}: ${arb(v, [p, k].join(SEPARATOR), false)}`)
        .join(',\n');
      if (!root) {
        return `{${returnedObjectString}}`;
      }
      return returnedObjectString;
    }
    return `${a}`;
  };
  return arb;
};

export const resolverFor = <
  X,
  T extends keyof ResolverInputTypes,
  Z extends keyof ResolverInputTypes[T],
  RET = unknown,
>(
  type: T,
  field: Z,
  fn: (
    args: Required<ResolverInputTypes[T]>[Z] extends [infer Input, any] ? Input : any,
    source: any,
  ) => Z extends keyof ModelTypes[T] ? ModelTypes[T][Z] | Promise<ModelTypes[T][Z]> | X : RET,
) => fn as (args?: any, source?: any) => RET;

export type UnwrapPromise<T> = T extends Promise<infer R> ? R : T;
export type ZeusState<T extends (...args: any[]) => Promise<any>> = NonNullable<UnwrapPromise<ReturnType<T>>>;
export type ZeusHook<
  T extends (...args: any[]) => Record<string, (...args: any[]) => Promise<any>>,
  N extends keyof ReturnType<T>,
> = ZeusState<ReturnType<T>[N]>;

export type WithTypeNameValue<T> = T & {
  __typename?: boolean;
  __directives?: string;
};
export type AliasType<T> = WithTypeNameValue<T> & {
  __alias?: Record<string, WithTypeNameValue<T>>;
};
type DeepAnify<T> = {
  [P in keyof T]?: any;
};
type IsPayLoad<T> = T extends [any, infer PayLoad] ? PayLoad : T;
export type ScalarDefinition = Record<string, ScalarResolver>;

type IsScalar<S, SCLR extends ScalarDefinition> = S extends 'scalar' & { name: infer T }
  ? T extends keyof SCLR
    ? SCLR[T]['decode'] extends (s: unknown) => unknown
      ? ReturnType<SCLR[T]['decode']>
      : unknown
    : unknown
  : S;
type IsArray<T, U, SCLR extends ScalarDefinition> = T extends Array<infer R>
  ? InputType<R, U, SCLR>[]
  : InputType<T, U, SCLR>;
type FlattenArray<T> = T extends Array<infer R> ? R : T;
type BaseZeusResolver = boolean | 1 | string | Variable<any, string>;

type IsInterfaced<SRC extends DeepAnify<DST>, DST, SCLR extends ScalarDefinition> = FlattenArray<SRC> extends
  | ZEUS_INTERFACES
  | ZEUS_UNIONS
  ? {
      [P in keyof SRC]: SRC[P] extends '__union' & infer R
        ? P extends keyof DST
          ? IsArray<R, '__typename' extends keyof DST ? DST[P] & { __typename: true } : DST[P], SCLR>
          : IsArray<R, '__typename' extends keyof DST ? { __typename: true } : never, SCLR>
        : never;
    }[keyof SRC] & {
      [P in keyof Omit<
        Pick<
          SRC,
          {
            [P in keyof DST]: SRC[P] extends '__union' & infer R ? never : P;
          }[keyof DST]
        >,
        '__typename'
      >]: IsPayLoad<DST[P]> extends BaseZeusResolver ? IsScalar<SRC[P], SCLR> : IsArray<SRC[P], DST[P], SCLR>;
    }
  : {
      [P in keyof Pick<SRC, keyof DST>]: IsPayLoad<DST[P]> extends BaseZeusResolver
        ? IsScalar<SRC[P], SCLR>
        : IsArray<SRC[P], DST[P], SCLR>;
    };

export type MapType<SRC, DST, SCLR extends ScalarDefinition> = SRC extends DeepAnify<DST>
  ? IsInterfaced<SRC, DST, SCLR>
  : never;
// eslint-disable-next-line @typescript-eslint/ban-types
export type InputType<SRC, DST, SCLR extends ScalarDefinition = {}> = IsPayLoad<DST> extends { __alias: infer R }
  ? {
      [P in keyof R]: MapType<SRC, R[P], SCLR>[keyof MapType<SRC, R[P], SCLR>];
    } & MapType<SRC, Omit<IsPayLoad<DST>, '__alias'>, SCLR>
  : MapType<SRC, IsPayLoad<DST>, SCLR>;
export type SubscriptionToGraphQL<Z, T, SCLR extends ScalarDefinition> = {
  ws: WebSocket;
  on: (fn: (args: InputType<T, Z, SCLR>) => void) => void;
  off: (fn: (e: { data?: InputType<T, Z, SCLR>; code?: number; reason?: string; message?: string }) => void) => void;
  error: (fn: (e: { data?: InputType<T, Z, SCLR>; errors?: string[] }) => void) => void;
  open: () => void;
};

// eslint-disable-next-line @typescript-eslint/ban-types
export type FromSelector<SELECTOR, NAME extends keyof GraphQLTypes, SCLR extends ScalarDefinition = {}> = InputType<
  GraphQLTypes[NAME],
  SELECTOR,
  SCLR
>;

export type ScalarResolver = {
  encode?: (s: unknown) => string;
  decode?: (s: unknown) => unknown;
};

export type SelectionFunction<V> = <T>(t: T | V) => T;

type BuiltInVariableTypes = {
  ['String']: string;
  ['Int']: number;
  ['Float']: number;
  ['ID']: unknown;
  ['Boolean']: boolean;
};
type AllVariableTypes = keyof BuiltInVariableTypes | keyof ZEUS_VARIABLES;
type VariableRequired<T extends string> = `${T}!` | T | `[${T}]` | `[${T}]!` | `[${T}!]` | `[${T}!]!`;
type VR<T extends string> = VariableRequired<VariableRequired<T>>;

export type GraphQLVariableType = VR<AllVariableTypes>;

type ExtractVariableTypeString<T extends string> = T extends VR<infer R1>
  ? R1 extends VR<infer R2>
    ? R2 extends VR<infer R3>
      ? R3 extends VR<infer R4>
        ? R4 extends VR<infer R5>
          ? R5
          : R4
        : R3
      : R2
    : R1
  : T;

type DecomposeType<T, Type> = T extends `[${infer R}]`
  ? Array<DecomposeType<R, Type>> | undefined
  : T extends `${infer R}!`
  ? NonNullable<DecomposeType<R, Type>>
  : Type | undefined;

type ExtractTypeFromGraphQLType<T extends string> = T extends keyof ZEUS_VARIABLES
  ? ZEUS_VARIABLES[T]
  : T extends keyof BuiltInVariableTypes
  ? BuiltInVariableTypes[T]
  : any;

export type GetVariableType<T extends string> = DecomposeType<
  T,
  ExtractTypeFromGraphQLType<ExtractVariableTypeString<T>>
>;

type UndefinedKeys<T> = {
  [K in keyof T]-?: T[K] extends NonNullable<T[K]> ? never : K;
}[keyof T];

type WithNullableKeys<T> = Pick<T, UndefinedKeys<T>>;
type WithNonNullableKeys<T> = Omit<T, UndefinedKeys<T>>;

type OptionalKeys<T> = {
  [P in keyof T]?: T[P];
};

export type WithOptionalNullables<T> = OptionalKeys<WithNullableKeys<T>> & WithNonNullableKeys<T>;

export type Variable<T extends GraphQLVariableType, Name extends string> = {
  ' __zeus_name': Name;
  ' __zeus_type': T;
};

export type ExtractVariables<Query> = Query extends Variable<infer VType, infer VName>
  ? { [key in VName]: GetVariableType<VType> }
  : Query extends [infer Inputs, infer Outputs]
  ? ExtractVariables<Inputs> & ExtractVariables<Outputs>
  : Query extends string | number | boolean
  ? // eslint-disable-next-line @typescript-eslint/ban-types
    {}
  : UnionToIntersection<{ [K in keyof Query]: WithOptionalNullables<ExtractVariables<Query[K]>> }[keyof Query]>;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

export const START_VAR_NAME = `$ZEUS_VAR`;
export const GRAPHQL_TYPE_SEPARATOR = `__$GRAPHQL__`;

export const $ = <Type extends GraphQLVariableType, Name extends string>(name: Name, graphqlType: Type) => {
  return (START_VAR_NAME + name + GRAPHQL_TYPE_SEPARATOR + graphqlType) as unknown as Variable<Type, Name>;
};
type ZEUS_INTERFACES = never
export type ScalarCoders = {
	Date?: ScalarResolver;
	GraphQLStringOrFloat?: ScalarResolver;
	JSON?: ScalarResolver;
}
type ZEUS_UNIONS = never

export type ValueTypes = {
    ["boolean_filter_operators"]: {
	_eq?: boolean | undefined | null | Variable<any, string>,
	_neq?: boolean | undefined | null | Variable<any, string>,
	_null?: boolean | undefined | null | Variable<any, string>,
	_nnull?: boolean | undefined | null | Variable<any, string>
};
	["certificates"]: AliasType<{
	id?:boolean | `@${string}`,
	user_created?:boolean | `@${string}`,
	date_created?:boolean | `@${string}`,
	date_created_func?:ValueTypes["datetime_functions"],
	date_updated?:boolean | `@${string}`,
	date_updated_func?:ValueTypes["datetime_functions"],
	full_name?:boolean | `@${string}`,
	ic?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	/** CDA Number / DM number / PM number */
	cda_number?:boolean | `@${string}`,
	total_days?:boolean | `@${string}`,
	test_score?:boolean | `@${string}`,
	marks?:boolean | `@${string}`,
	location?:boolean | `@${string}`,
	course?:boolean | `@${string}`,
	course_start_date?:boolean | `@${string}`,
	course_end_date?:boolean | `@${string}`,
	/** Email of the certificate holder */
	email?:boolean | `@${string}`,
	certificate?:boolean | `@${string}`,
	number_title?:boolean | `@${string}`,
	position?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["certificates_aggregated"]: AliasType<{
	group?:boolean | `@${string}`,
	countAll?:boolean | `@${string}`,
	count?:ValueTypes["certificates_aggregated_count"],
	countDistinct?:ValueTypes["certificates_aggregated_count"],
	avg?:ValueTypes["certificates_aggregated_fields"],
	sum?:ValueTypes["certificates_aggregated_fields"],
	avgDistinct?:ValueTypes["certificates_aggregated_fields"],
	sumDistinct?:ValueTypes["certificates_aggregated_fields"],
	min?:ValueTypes["certificates_aggregated_fields"],
	max?:ValueTypes["certificates_aggregated_fields"],
		__typename?: boolean | `@${string}`
}>;
	["certificates_aggregated_count"]: AliasType<{
	id?:boolean | `@${string}`,
	user_created?:boolean | `@${string}`,
	date_created?:boolean | `@${string}`,
	date_updated?:boolean | `@${string}`,
	full_name?:boolean | `@${string}`,
	ic?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	/** CDA Number / DM number / PM number */
	cda_number?:boolean | `@${string}`,
	total_days?:boolean | `@${string}`,
	test_score?:boolean | `@${string}`,
	marks?:boolean | `@${string}`,
	location?:boolean | `@${string}`,
	course?:boolean | `@${string}`,
	course_start_date?:boolean | `@${string}`,
	course_end_date?:boolean | `@${string}`,
	/** Email of the certificate holder */
	email?:boolean | `@${string}`,
	certificate?:boolean | `@${string}`,
	number_title?:boolean | `@${string}`,
	position?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["certificates_aggregated_fields"]: AliasType<{
	total_days?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["certificates_filter"]: {
	id?: ValueTypes["string_filter_operators"] | undefined | null | Variable<any, string>,
	user_created?: ValueTypes["string_filter_operators"] | undefined | null | Variable<any, string>,
	date_created?: ValueTypes["date_filter_operators"] | undefined | null | Variable<any, string>,
	date_created_func?: ValueTypes["datetime_function_filter_operators"] | undefined | null | Variable<any, string>,
	date_updated?: ValueTypes["date_filter_operators"] | undefined | null | Variable<any, string>,
	date_updated_func?: ValueTypes["datetime_function_filter_operators"] | undefined | null | Variable<any, string>,
	full_name?: ValueTypes["string_filter_operators"] | undefined | null | Variable<any, string>,
	ic?: ValueTypes["string_filter_operators"] | undefined | null | Variable<any, string>,
	phone?: ValueTypes["string_filter_operators"] | undefined | null | Variable<any, string>,
	cda_number?: ValueTypes["string_filter_operators"] | undefined | null | Variable<any, string>,
	total_days?: ValueTypes["number_filter_operators"] | undefined | null | Variable<any, string>,
	test_score?: ValueTypes["string_filter_operators"] | undefined | null | Variable<any, string>,
	marks?: ValueTypes["string_filter_operators"] | undefined | null | Variable<any, string>,
	location?: ValueTypes["string_filter_operators"] | undefined | null | Variable<any, string>,
	course?: ValueTypes["string_filter_operators"] | undefined | null | Variable<any, string>,
	course_start_date?: ValueTypes["string_filter_operators"] | undefined | null | Variable<any, string>,
	course_end_date?: ValueTypes["string_filter_operators"] | undefined | null | Variable<any, string>,
	email?: ValueTypes["string_filter_operators"] | undefined | null | Variable<any, string>,
	certificate?: ValueTypes["string_filter_operators"] | undefined | null | Variable<any, string>,
	number_title?: ValueTypes["string_filter_operators"] | undefined | null | Variable<any, string>,
	position?: ValueTypes["string_filter_operators"] | undefined | null | Variable<any, string>,
	_and?: Array<ValueTypes["certificates_filter"] | undefined | null> | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["certificates_filter"] | undefined | null> | undefined | null | Variable<any, string>
};
	["create_student_login_input"]: {
	id?: string | undefined | null | Variable<any, string>,
	date_created?: ValueTypes["Date"] | undefined | null | Variable<any, string>,
	email?: string | undefined | null | Variable<any, string>,
	phone?: string | undefined | null | Variable<any, string>,
	ic?: string | undefined | null | Variable<any, string>
};
	["create_verified_details_input"]: {
	id?: string | undefined | null | Variable<any, string>,
	user_created?: string | undefined | null | Variable<any, string>,
	date_created?: ValueTypes["Date"] | undefined | null | Variable<any, string>,
	date_updated?: ValueTypes["Date"] | undefined | null | Variable<any, string>,
	/** Email of the person who wanted to verify the certificate */
	email?: string | undefined | null | Variable<any, string>,
	/** Phone number of the person who wanted to verify the certificate */
	phone?: string | undefined | null | Variable<any, string>,
	/** Organization of the person */
	organization?: string | undefined | null | Variable<any, string>,
	/** Certificate number to be verified */
	certificate_number?: string | undefined | null | Variable<any, string>,
	verified?: boolean | undefined | null | Variable<any, string>
};
	/** ISO8601 Date values */
["Date"]:unknown;
	["date_filter_operators"]: {
	_eq?: string | undefined | null | Variable<any, string>,
	_neq?: string | undefined | null | Variable<any, string>,
	_gt?: string | undefined | null | Variable<any, string>,
	_gte?: string | undefined | null | Variable<any, string>,
	_lt?: string | undefined | null | Variable<any, string>,
	_lte?: string | undefined | null | Variable<any, string>,
	_null?: boolean | undefined | null | Variable<any, string>,
	_nnull?: boolean | undefined | null | Variable<any, string>,
	_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	_nin?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	_between?: Array<ValueTypes["GraphQLStringOrFloat"] | undefined | null> | undefined | null | Variable<any, string>,
	_nbetween?: Array<ValueTypes["GraphQLStringOrFloat"] | undefined | null> | undefined | null | Variable<any, string>
};
	["datetime_function_filter_operators"]: {
	year?: ValueTypes["number_filter_operators"] | undefined | null | Variable<any, string>,
	month?: ValueTypes["number_filter_operators"] | undefined | null | Variable<any, string>,
	week?: ValueTypes["number_filter_operators"] | undefined | null | Variable<any, string>,
	day?: ValueTypes["number_filter_operators"] | undefined | null | Variable<any, string>,
	weekday?: ValueTypes["number_filter_operators"] | undefined | null | Variable<any, string>,
	hour?: ValueTypes["number_filter_operators"] | undefined | null | Variable<any, string>,
	minute?: ValueTypes["number_filter_operators"] | undefined | null | Variable<any, string>,
	second?: ValueTypes["number_filter_operators"] | undefined | null | Variable<any, string>
};
	["datetime_functions"]: AliasType<{
	year?:boolean | `@${string}`,
	month?:boolean | `@${string}`,
	week?:boolean | `@${string}`,
	day?:boolean | `@${string}`,
	weekday?:boolean | `@${string}`,
	hour?:boolean | `@${string}`,
	minute?:boolean | `@${string}`,
	second?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** A Float or a String */
["GraphQLStringOrFloat"]:unknown;
	/** The `JSON` scalar type represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
["JSON"]:unknown;
	["Mutation"]: AliasType<{
create_verified_details_items?: [{	filter?: ValueTypes["verified_details_filter"] | undefined | null | Variable<any, string>,	sort?: Array<string | undefined | null> | undefined | null | Variable<any, string>,	limit?: number | undefined | null | Variable<any, string>,	offset?: number | undefined | null | Variable<any, string>,	page?: number | undefined | null | Variable<any, string>,	search?: string | undefined | null | Variable<any, string>,	data?: Array<ValueTypes["create_verified_details_input"]> | undefined | null | Variable<any, string>},ValueTypes["verified_details"]],
create_verified_details_item?: [{	data: ValueTypes["create_verified_details_input"] | Variable<any, string>},ValueTypes["verified_details"]],
create_student_login_items?: [{	filter?: ValueTypes["student_login_filter"] | undefined | null | Variable<any, string>,	sort?: Array<string | undefined | null> | undefined | null | Variable<any, string>,	limit?: number | undefined | null | Variable<any, string>,	offset?: number | undefined | null | Variable<any, string>,	page?: number | undefined | null | Variable<any, string>,	search?: string | undefined | null | Variable<any, string>,	data?: Array<ValueTypes["create_student_login_input"]> | undefined | null | Variable<any, string>},ValueTypes["student_login"]],
create_student_login_item?: [{	data: ValueTypes["create_student_login_input"] | Variable<any, string>},ValueTypes["student_login"]],
update_verified_details_items?: [{	filter?: ValueTypes["verified_details_filter"] | undefined | null | Variable<any, string>,	sort?: Array<string | undefined | null> | undefined | null | Variable<any, string>,	limit?: number | undefined | null | Variable<any, string>,	offset?: number | undefined | null | Variable<any, string>,	page?: number | undefined | null | Variable<any, string>,	search?: string | undefined | null | Variable<any, string>,	ids: Array<string | undefined | null> | Variable<any, string>,	data: ValueTypes["update_verified_details_input"] | Variable<any, string>},ValueTypes["verified_details"]],
update_verified_details_batch?: [{	filter?: ValueTypes["verified_details_filter"] | undefined | null | Variable<any, string>,	sort?: Array<string | undefined | null> | undefined | null | Variable<any, string>,	limit?: number | undefined | null | Variable<any, string>,	offset?: number | undefined | null | Variable<any, string>,	page?: number | undefined | null | Variable<any, string>,	search?: string | undefined | null | Variable<any, string>,	data?: Array<ValueTypes["update_verified_details_input"]> | undefined | null | Variable<any, string>},ValueTypes["verified_details"]],
update_verified_details_item?: [{	id: string | Variable<any, string>,	data: ValueTypes["update_verified_details_input"] | Variable<any, string>},ValueTypes["verified_details"]],
update_certificates_items?: [{	filter?: ValueTypes["certificates_filter"] | undefined | null | Variable<any, string>,	sort?: Array<string | undefined | null> | undefined | null | Variable<any, string>,	limit?: number | undefined | null | Variable<any, string>,	offset?: number | undefined | null | Variable<any, string>,	page?: number | undefined | null | Variable<any, string>,	search?: string | undefined | null | Variable<any, string>,	ids: Array<string | undefined | null> | Variable<any, string>,	data: ValueTypes["update_certificates_input"] | Variable<any, string>},ValueTypes["certificates"]],
update_certificates_batch?: [{	filter?: ValueTypes["certificates_filter"] | undefined | null | Variable<any, string>,	sort?: Array<string | undefined | null> | undefined | null | Variable<any, string>,	limit?: number | undefined | null | Variable<any, string>,	offset?: number | undefined | null | Variable<any, string>,	page?: number | undefined | null | Variable<any, string>,	search?: string | undefined | null | Variable<any, string>,	data?: Array<ValueTypes["update_certificates_input"]> | undefined | null | Variable<any, string>},ValueTypes["certificates"]],
update_certificates_item?: [{	id: string | Variable<any, string>,	data: ValueTypes["update_certificates_input"] | Variable<any, string>},ValueTypes["certificates"]],
update_student_login_items?: [{	filter?: ValueTypes["student_login_filter"] | undefined | null | Variable<any, string>,	sort?: Array<string | undefined | null> | undefined | null | Variable<any, string>,	limit?: number | undefined | null | Variable<any, string>,	offset?: number | undefined | null | Variable<any, string>,	page?: number | undefined | null | Variable<any, string>,	search?: string | undefined | null | Variable<any, string>,	ids: Array<string | undefined | null> | Variable<any, string>,	data: ValueTypes["update_student_login_input"] | Variable<any, string>},ValueTypes["student_login"]],
update_student_login_batch?: [{	filter?: ValueTypes["student_login_filter"] | undefined | null | Variable<any, string>,	sort?: Array<string | undefined | null> | undefined | null | Variable<any, string>,	limit?: number | undefined | null | Variable<any, string>,	offset?: number | undefined | null | Variable<any, string>,	page?: number | undefined | null | Variable<any, string>,	search?: string | undefined | null | Variable<any, string>,	data?: Array<ValueTypes["update_student_login_input"]> | undefined | null | Variable<any, string>},ValueTypes["student_login"]],
update_student_login_item?: [{	id: string | Variable<any, string>,	data: ValueTypes["update_student_login_input"] | Variable<any, string>},ValueTypes["student_login"]],
		__typename?: boolean | `@${string}`
}>;
	["number_filter_operators"]: {
	_eq?: ValueTypes["GraphQLStringOrFloat"] | undefined | null | Variable<any, string>,
	_neq?: ValueTypes["GraphQLStringOrFloat"] | undefined | null | Variable<any, string>,
	_in?: Array<ValueTypes["GraphQLStringOrFloat"] | undefined | null> | undefined | null | Variable<any, string>,
	_nin?: Array<ValueTypes["GraphQLStringOrFloat"] | undefined | null> | undefined | null | Variable<any, string>,
	_gt?: ValueTypes["GraphQLStringOrFloat"] | undefined | null | Variable<any, string>,
	_gte?: ValueTypes["GraphQLStringOrFloat"] | undefined | null | Variable<any, string>,
	_lt?: ValueTypes["GraphQLStringOrFloat"] | undefined | null | Variable<any, string>,
	_lte?: ValueTypes["GraphQLStringOrFloat"] | undefined | null | Variable<any, string>,
	_null?: boolean | undefined | null | Variable<any, string>,
	_nnull?: boolean | undefined | null | Variable<any, string>,
	_between?: Array<ValueTypes["GraphQLStringOrFloat"] | undefined | null> | undefined | null | Variable<any, string>,
	_nbetween?: Array<ValueTypes["GraphQLStringOrFloat"] | undefined | null> | undefined | null | Variable<any, string>
};
	["Query"]: AliasType<{
verified_details?: [{	filter?: ValueTypes["verified_details_filter"] | undefined | null | Variable<any, string>,	sort?: Array<string | undefined | null> | undefined | null | Variable<any, string>,	limit?: number | undefined | null | Variable<any, string>,	offset?: number | undefined | null | Variable<any, string>,	page?: number | undefined | null | Variable<any, string>,	search?: string | undefined | null | Variable<any, string>},ValueTypes["verified_details"]],
verified_details_by_id?: [{	id: string | Variable<any, string>},ValueTypes["verified_details"]],
verified_details_aggregated?: [{	groupBy?: Array<string | undefined | null> | undefined | null | Variable<any, string>,	filter?: ValueTypes["verified_details_filter"] | undefined | null | Variable<any, string>,	limit?: number | undefined | null | Variable<any, string>,	search?: string | undefined | null | Variable<any, string>,	sort?: Array<string | undefined | null> | undefined | null | Variable<any, string>},ValueTypes["verified_details_aggregated"]],
certificates?: [{	filter?: ValueTypes["certificates_filter"] | undefined | null | Variable<any, string>,	sort?: Array<string | undefined | null> | undefined | null | Variable<any, string>,	limit?: number | undefined | null | Variable<any, string>,	offset?: number | undefined | null | Variable<any, string>,	page?: number | undefined | null | Variable<any, string>,	search?: string | undefined | null | Variable<any, string>},ValueTypes["certificates"]],
certificates_by_id?: [{	id: string | Variable<any, string>},ValueTypes["certificates"]],
certificates_aggregated?: [{	groupBy?: Array<string | undefined | null> | undefined | null | Variable<any, string>,	filter?: ValueTypes["certificates_filter"] | undefined | null | Variable<any, string>,	limit?: number | undefined | null | Variable<any, string>,	search?: string | undefined | null | Variable<any, string>,	sort?: Array<string | undefined | null> | undefined | null | Variable<any, string>},ValueTypes["certificates_aggregated"]],
student_login?: [{	filter?: ValueTypes["student_login_filter"] | undefined | null | Variable<any, string>,	sort?: Array<string | undefined | null> | undefined | null | Variable<any, string>,	limit?: number | undefined | null | Variable<any, string>,	offset?: number | undefined | null | Variable<any, string>,	page?: number | undefined | null | Variable<any, string>,	search?: string | undefined | null | Variable<any, string>},ValueTypes["student_login"]],
student_login_by_id?: [{	id: string | Variable<any, string>},ValueTypes["student_login"]],
student_login_aggregated?: [{	groupBy?: Array<string | undefined | null> | undefined | null | Variable<any, string>,	filter?: ValueTypes["student_login_filter"] | undefined | null | Variable<any, string>,	limit?: number | undefined | null | Variable<any, string>,	search?: string | undefined | null | Variable<any, string>,	sort?: Array<string | undefined | null> | undefined | null | Variable<any, string>},ValueTypes["student_login_aggregated"]],
		__typename?: boolean | `@${string}`
}>;
	["string_filter_operators"]: {
	_eq?: string | undefined | null | Variable<any, string>,
	_neq?: string | undefined | null | Variable<any, string>,
	_contains?: string | undefined | null | Variable<any, string>,
	_icontains?: string | undefined | null | Variable<any, string>,
	_ncontains?: string | undefined | null | Variable<any, string>,
	_starts_with?: string | undefined | null | Variable<any, string>,
	_nstarts_with?: string | undefined | null | Variable<any, string>,
	_ends_with?: string | undefined | null | Variable<any, string>,
	_nends_with?: string | undefined | null | Variable<any, string>,
	_in?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	_nin?: Array<string | undefined | null> | undefined | null | Variable<any, string>,
	_null?: boolean | undefined | null | Variable<any, string>,
	_nnull?: boolean | undefined | null | Variable<any, string>,
	_empty?: boolean | undefined | null | Variable<any, string>,
	_nempty?: boolean | undefined | null | Variable<any, string>
};
	["student_login"]: AliasType<{
	id?:boolean | `@${string}`,
	date_created?:boolean | `@${string}`,
	date_created_func?:ValueTypes["datetime_functions"],
	email?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	ic?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["student_login_aggregated"]: AliasType<{
	group?:boolean | `@${string}`,
	countAll?:boolean | `@${string}`,
	count?:ValueTypes["student_login_aggregated_count"],
	countDistinct?:ValueTypes["student_login_aggregated_count"],
		__typename?: boolean | `@${string}`
}>;
	["student_login_aggregated_count"]: AliasType<{
	id?:boolean | `@${string}`,
	date_created?:boolean | `@${string}`,
	email?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	ic?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["student_login_filter"]: {
	id?: ValueTypes["string_filter_operators"] | undefined | null | Variable<any, string>,
	date_created?: ValueTypes["date_filter_operators"] | undefined | null | Variable<any, string>,
	date_created_func?: ValueTypes["datetime_function_filter_operators"] | undefined | null | Variable<any, string>,
	email?: ValueTypes["string_filter_operators"] | undefined | null | Variable<any, string>,
	phone?: ValueTypes["string_filter_operators"] | undefined | null | Variable<any, string>,
	ic?: ValueTypes["string_filter_operators"] | undefined | null | Variable<any, string>,
	_and?: Array<ValueTypes["student_login_filter"] | undefined | null> | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["student_login_filter"] | undefined | null> | undefined | null | Variable<any, string>
};
	["update_certificates_input"]: {
	id?: string | undefined | null | Variable<any, string>,
	user_created?: string | undefined | null | Variable<any, string>,
	date_created?: ValueTypes["Date"] | undefined | null | Variable<any, string>,
	date_updated?: ValueTypes["Date"] | undefined | null | Variable<any, string>,
	full_name?: string | undefined | null | Variable<any, string>,
	ic?: string | undefined | null | Variable<any, string>,
	phone?: string | undefined | null | Variable<any, string>,
	/** CDA Number / DM number / PM number */
	cda_number?: string | undefined | null | Variable<any, string>,
	total_days?: number | undefined | null | Variable<any, string>,
	test_score?: string | undefined | null | Variable<any, string>,
	marks?: string | undefined | null | Variable<any, string>,
	location?: string | undefined | null | Variable<any, string>,
	course?: string | undefined | null | Variable<any, string>,
	course_start_date?: string | undefined | null | Variable<any, string>,
	course_end_date?: string | undefined | null | Variable<any, string>,
	/** Email of the certificate holder */
	email?: string | undefined | null | Variable<any, string>,
	certificate?: string | undefined | null | Variable<any, string>,
	number_title?: string | undefined | null | Variable<any, string>,
	position?: string | undefined | null | Variable<any, string>
};
	["update_student_login_input"]: {
	id?: string | undefined | null | Variable<any, string>,
	date_created?: ValueTypes["Date"] | undefined | null | Variable<any, string>,
	email?: string | undefined | null | Variable<any, string>,
	phone?: string | undefined | null | Variable<any, string>,
	ic?: string | undefined | null | Variable<any, string>
};
	["update_verified_details_input"]: {
	id?: string | undefined | null | Variable<any, string>,
	user_created?: string | undefined | null | Variable<any, string>,
	date_created?: ValueTypes["Date"] | undefined | null | Variable<any, string>,
	date_updated?: ValueTypes["Date"] | undefined | null | Variable<any, string>,
	/** Email of the person who wanted to verify the certificate */
	email?: string | undefined | null | Variable<any, string>,
	/** Phone number of the person who wanted to verify the certificate */
	phone?: string | undefined | null | Variable<any, string>,
	/** Organization of the person */
	organization?: string | undefined | null | Variable<any, string>,
	/** Certificate number to be verified */
	certificate_number?: string | undefined | null | Variable<any, string>,
	verified?: boolean | undefined | null | Variable<any, string>
};
	["verified_details"]: AliasType<{
	id?:boolean | `@${string}`,
	user_created?:boolean | `@${string}`,
	date_created?:boolean | `@${string}`,
	date_created_func?:ValueTypes["datetime_functions"],
	date_updated?:boolean | `@${string}`,
	date_updated_func?:ValueTypes["datetime_functions"],
	/** Email of the person who wanted to verify the certificate */
	email?:boolean | `@${string}`,
	/** Phone number of the person who wanted to verify the certificate */
	phone?:boolean | `@${string}`,
	/** Organization of the person */
	organization?:boolean | `@${string}`,
	/** Certificate number to be verified */
	certificate_number?:boolean | `@${string}`,
	verified?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["verified_details_aggregated"]: AliasType<{
	group?:boolean | `@${string}`,
	countAll?:boolean | `@${string}`,
	count?:ValueTypes["verified_details_aggregated_count"],
	countDistinct?:ValueTypes["verified_details_aggregated_count"],
		__typename?: boolean | `@${string}`
}>;
	["verified_details_aggregated_count"]: AliasType<{
	id?:boolean | `@${string}`,
	user_created?:boolean | `@${string}`,
	date_created?:boolean | `@${string}`,
	date_updated?:boolean | `@${string}`,
	/** Email of the person who wanted to verify the certificate */
	email?:boolean | `@${string}`,
	/** Phone number of the person who wanted to verify the certificate */
	phone?:boolean | `@${string}`,
	/** Organization of the person */
	organization?:boolean | `@${string}`,
	/** Certificate number to be verified */
	certificate_number?:boolean | `@${string}`,
	verified?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["verified_details_filter"]: {
	id?: ValueTypes["string_filter_operators"] | undefined | null | Variable<any, string>,
	user_created?: ValueTypes["string_filter_operators"] | undefined | null | Variable<any, string>,
	date_created?: ValueTypes["date_filter_operators"] | undefined | null | Variable<any, string>,
	date_created_func?: ValueTypes["datetime_function_filter_operators"] | undefined | null | Variable<any, string>,
	date_updated?: ValueTypes["date_filter_operators"] | undefined | null | Variable<any, string>,
	date_updated_func?: ValueTypes["datetime_function_filter_operators"] | undefined | null | Variable<any, string>,
	email?: ValueTypes["string_filter_operators"] | undefined | null | Variable<any, string>,
	phone?: ValueTypes["string_filter_operators"] | undefined | null | Variable<any, string>,
	organization?: ValueTypes["string_filter_operators"] | undefined | null | Variable<any, string>,
	certificate_number?: ValueTypes["string_filter_operators"] | undefined | null | Variable<any, string>,
	verified?: ValueTypes["boolean_filter_operators"] | undefined | null | Variable<any, string>,
	_and?: Array<ValueTypes["verified_details_filter"] | undefined | null> | undefined | null | Variable<any, string>,
	_or?: Array<ValueTypes["verified_details_filter"] | undefined | null> | undefined | null | Variable<any, string>
}
  }

export type ResolverInputTypes = {
    ["boolean_filter_operators"]: {
	_eq?: boolean | undefined | null,
	_neq?: boolean | undefined | null,
	_null?: boolean | undefined | null,
	_nnull?: boolean | undefined | null
};
	["certificates"]: AliasType<{
	id?:boolean | `@${string}`,
	user_created?:boolean | `@${string}`,
	date_created?:boolean | `@${string}`,
	date_created_func?:ResolverInputTypes["datetime_functions"],
	date_updated?:boolean | `@${string}`,
	date_updated_func?:ResolverInputTypes["datetime_functions"],
	full_name?:boolean | `@${string}`,
	ic?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	/** CDA Number / DM number / PM number */
	cda_number?:boolean | `@${string}`,
	total_days?:boolean | `@${string}`,
	test_score?:boolean | `@${string}`,
	marks?:boolean | `@${string}`,
	location?:boolean | `@${string}`,
	course?:boolean | `@${string}`,
	course_start_date?:boolean | `@${string}`,
	course_end_date?:boolean | `@${string}`,
	/** Email of the certificate holder */
	email?:boolean | `@${string}`,
	certificate?:boolean | `@${string}`,
	number_title?:boolean | `@${string}`,
	position?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["certificates_aggregated"]: AliasType<{
	group?:boolean | `@${string}`,
	countAll?:boolean | `@${string}`,
	count?:ResolverInputTypes["certificates_aggregated_count"],
	countDistinct?:ResolverInputTypes["certificates_aggregated_count"],
	avg?:ResolverInputTypes["certificates_aggregated_fields"],
	sum?:ResolverInputTypes["certificates_aggregated_fields"],
	avgDistinct?:ResolverInputTypes["certificates_aggregated_fields"],
	sumDistinct?:ResolverInputTypes["certificates_aggregated_fields"],
	min?:ResolverInputTypes["certificates_aggregated_fields"],
	max?:ResolverInputTypes["certificates_aggregated_fields"],
		__typename?: boolean | `@${string}`
}>;
	["certificates_aggregated_count"]: AliasType<{
	id?:boolean | `@${string}`,
	user_created?:boolean | `@${string}`,
	date_created?:boolean | `@${string}`,
	date_updated?:boolean | `@${string}`,
	full_name?:boolean | `@${string}`,
	ic?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	/** CDA Number / DM number / PM number */
	cda_number?:boolean | `@${string}`,
	total_days?:boolean | `@${string}`,
	test_score?:boolean | `@${string}`,
	marks?:boolean | `@${string}`,
	location?:boolean | `@${string}`,
	course?:boolean | `@${string}`,
	course_start_date?:boolean | `@${string}`,
	course_end_date?:boolean | `@${string}`,
	/** Email of the certificate holder */
	email?:boolean | `@${string}`,
	certificate?:boolean | `@${string}`,
	number_title?:boolean | `@${string}`,
	position?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["certificates_aggregated_fields"]: AliasType<{
	total_days?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["certificates_filter"]: {
	id?: ResolverInputTypes["string_filter_operators"] | undefined | null,
	user_created?: ResolverInputTypes["string_filter_operators"] | undefined | null,
	date_created?: ResolverInputTypes["date_filter_operators"] | undefined | null,
	date_created_func?: ResolverInputTypes["datetime_function_filter_operators"] | undefined | null,
	date_updated?: ResolverInputTypes["date_filter_operators"] | undefined | null,
	date_updated_func?: ResolverInputTypes["datetime_function_filter_operators"] | undefined | null,
	full_name?: ResolverInputTypes["string_filter_operators"] | undefined | null,
	ic?: ResolverInputTypes["string_filter_operators"] | undefined | null,
	phone?: ResolverInputTypes["string_filter_operators"] | undefined | null,
	cda_number?: ResolverInputTypes["string_filter_operators"] | undefined | null,
	total_days?: ResolverInputTypes["number_filter_operators"] | undefined | null,
	test_score?: ResolverInputTypes["string_filter_operators"] | undefined | null,
	marks?: ResolverInputTypes["string_filter_operators"] | undefined | null,
	location?: ResolverInputTypes["string_filter_operators"] | undefined | null,
	course?: ResolverInputTypes["string_filter_operators"] | undefined | null,
	course_start_date?: ResolverInputTypes["string_filter_operators"] | undefined | null,
	course_end_date?: ResolverInputTypes["string_filter_operators"] | undefined | null,
	email?: ResolverInputTypes["string_filter_operators"] | undefined | null,
	certificate?: ResolverInputTypes["string_filter_operators"] | undefined | null,
	number_title?: ResolverInputTypes["string_filter_operators"] | undefined | null,
	position?: ResolverInputTypes["string_filter_operators"] | undefined | null,
	_and?: Array<ResolverInputTypes["certificates_filter"] | undefined | null> | undefined | null,
	_or?: Array<ResolverInputTypes["certificates_filter"] | undefined | null> | undefined | null
};
	["create_student_login_input"]: {
	id?: string | undefined | null,
	date_created?: ResolverInputTypes["Date"] | undefined | null,
	email?: string | undefined | null,
	phone?: string | undefined | null,
	ic?: string | undefined | null
};
	["create_verified_details_input"]: {
	id?: string | undefined | null,
	user_created?: string | undefined | null,
	date_created?: ResolverInputTypes["Date"] | undefined | null,
	date_updated?: ResolverInputTypes["Date"] | undefined | null,
	/** Email of the person who wanted to verify the certificate */
	email?: string | undefined | null,
	/** Phone number of the person who wanted to verify the certificate */
	phone?: string | undefined | null,
	/** Organization of the person */
	organization?: string | undefined | null,
	/** Certificate number to be verified */
	certificate_number?: string | undefined | null,
	verified?: boolean | undefined | null
};
	/** ISO8601 Date values */
["Date"]:unknown;
	["date_filter_operators"]: {
	_eq?: string | undefined | null,
	_neq?: string | undefined | null,
	_gt?: string | undefined | null,
	_gte?: string | undefined | null,
	_lt?: string | undefined | null,
	_lte?: string | undefined | null,
	_null?: boolean | undefined | null,
	_nnull?: boolean | undefined | null,
	_in?: Array<string | undefined | null> | undefined | null,
	_nin?: Array<string | undefined | null> | undefined | null,
	_between?: Array<ResolverInputTypes["GraphQLStringOrFloat"] | undefined | null> | undefined | null,
	_nbetween?: Array<ResolverInputTypes["GraphQLStringOrFloat"] | undefined | null> | undefined | null
};
	["datetime_function_filter_operators"]: {
	year?: ResolverInputTypes["number_filter_operators"] | undefined | null,
	month?: ResolverInputTypes["number_filter_operators"] | undefined | null,
	week?: ResolverInputTypes["number_filter_operators"] | undefined | null,
	day?: ResolverInputTypes["number_filter_operators"] | undefined | null,
	weekday?: ResolverInputTypes["number_filter_operators"] | undefined | null,
	hour?: ResolverInputTypes["number_filter_operators"] | undefined | null,
	minute?: ResolverInputTypes["number_filter_operators"] | undefined | null,
	second?: ResolverInputTypes["number_filter_operators"] | undefined | null
};
	["datetime_functions"]: AliasType<{
	year?:boolean | `@${string}`,
	month?:boolean | `@${string}`,
	week?:boolean | `@${string}`,
	day?:boolean | `@${string}`,
	weekday?:boolean | `@${string}`,
	hour?:boolean | `@${string}`,
	minute?:boolean | `@${string}`,
	second?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	/** A Float or a String */
["GraphQLStringOrFloat"]:unknown;
	/** The `JSON` scalar type represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
["JSON"]:unknown;
	["Mutation"]: AliasType<{
create_verified_details_items?: [{	filter?: ResolverInputTypes["verified_details_filter"] | undefined | null,	sort?: Array<string | undefined | null> | undefined | null,	limit?: number | undefined | null,	offset?: number | undefined | null,	page?: number | undefined | null,	search?: string | undefined | null,	data?: Array<ResolverInputTypes["create_verified_details_input"]> | undefined | null},ResolverInputTypes["verified_details"]],
create_verified_details_item?: [{	data: ResolverInputTypes["create_verified_details_input"]},ResolverInputTypes["verified_details"]],
create_student_login_items?: [{	filter?: ResolverInputTypes["student_login_filter"] | undefined | null,	sort?: Array<string | undefined | null> | undefined | null,	limit?: number | undefined | null,	offset?: number | undefined | null,	page?: number | undefined | null,	search?: string | undefined | null,	data?: Array<ResolverInputTypes["create_student_login_input"]> | undefined | null},ResolverInputTypes["student_login"]],
create_student_login_item?: [{	data: ResolverInputTypes["create_student_login_input"]},ResolverInputTypes["student_login"]],
update_verified_details_items?: [{	filter?: ResolverInputTypes["verified_details_filter"] | undefined | null,	sort?: Array<string | undefined | null> | undefined | null,	limit?: number | undefined | null,	offset?: number | undefined | null,	page?: number | undefined | null,	search?: string | undefined | null,	ids: Array<string | undefined | null>,	data: ResolverInputTypes["update_verified_details_input"]},ResolverInputTypes["verified_details"]],
update_verified_details_batch?: [{	filter?: ResolverInputTypes["verified_details_filter"] | undefined | null,	sort?: Array<string | undefined | null> | undefined | null,	limit?: number | undefined | null,	offset?: number | undefined | null,	page?: number | undefined | null,	search?: string | undefined | null,	data?: Array<ResolverInputTypes["update_verified_details_input"]> | undefined | null},ResolverInputTypes["verified_details"]],
update_verified_details_item?: [{	id: string,	data: ResolverInputTypes["update_verified_details_input"]},ResolverInputTypes["verified_details"]],
update_certificates_items?: [{	filter?: ResolverInputTypes["certificates_filter"] | undefined | null,	sort?: Array<string | undefined | null> | undefined | null,	limit?: number | undefined | null,	offset?: number | undefined | null,	page?: number | undefined | null,	search?: string | undefined | null,	ids: Array<string | undefined | null>,	data: ResolverInputTypes["update_certificates_input"]},ResolverInputTypes["certificates"]],
update_certificates_batch?: [{	filter?: ResolverInputTypes["certificates_filter"] | undefined | null,	sort?: Array<string | undefined | null> | undefined | null,	limit?: number | undefined | null,	offset?: number | undefined | null,	page?: number | undefined | null,	search?: string | undefined | null,	data?: Array<ResolverInputTypes["update_certificates_input"]> | undefined | null},ResolverInputTypes["certificates"]],
update_certificates_item?: [{	id: string,	data: ResolverInputTypes["update_certificates_input"]},ResolverInputTypes["certificates"]],
update_student_login_items?: [{	filter?: ResolverInputTypes["student_login_filter"] | undefined | null,	sort?: Array<string | undefined | null> | undefined | null,	limit?: number | undefined | null,	offset?: number | undefined | null,	page?: number | undefined | null,	search?: string | undefined | null,	ids: Array<string | undefined | null>,	data: ResolverInputTypes["update_student_login_input"]},ResolverInputTypes["student_login"]],
update_student_login_batch?: [{	filter?: ResolverInputTypes["student_login_filter"] | undefined | null,	sort?: Array<string | undefined | null> | undefined | null,	limit?: number | undefined | null,	offset?: number | undefined | null,	page?: number | undefined | null,	search?: string | undefined | null,	data?: Array<ResolverInputTypes["update_student_login_input"]> | undefined | null},ResolverInputTypes["student_login"]],
update_student_login_item?: [{	id: string,	data: ResolverInputTypes["update_student_login_input"]},ResolverInputTypes["student_login"]],
		__typename?: boolean | `@${string}`
}>;
	["number_filter_operators"]: {
	_eq?: ResolverInputTypes["GraphQLStringOrFloat"] | undefined | null,
	_neq?: ResolverInputTypes["GraphQLStringOrFloat"] | undefined | null,
	_in?: Array<ResolverInputTypes["GraphQLStringOrFloat"] | undefined | null> | undefined | null,
	_nin?: Array<ResolverInputTypes["GraphQLStringOrFloat"] | undefined | null> | undefined | null,
	_gt?: ResolverInputTypes["GraphQLStringOrFloat"] | undefined | null,
	_gte?: ResolverInputTypes["GraphQLStringOrFloat"] | undefined | null,
	_lt?: ResolverInputTypes["GraphQLStringOrFloat"] | undefined | null,
	_lte?: ResolverInputTypes["GraphQLStringOrFloat"] | undefined | null,
	_null?: boolean | undefined | null,
	_nnull?: boolean | undefined | null,
	_between?: Array<ResolverInputTypes["GraphQLStringOrFloat"] | undefined | null> | undefined | null,
	_nbetween?: Array<ResolverInputTypes["GraphQLStringOrFloat"] | undefined | null> | undefined | null
};
	["Query"]: AliasType<{
verified_details?: [{	filter?: ResolverInputTypes["verified_details_filter"] | undefined | null,	sort?: Array<string | undefined | null> | undefined | null,	limit?: number | undefined | null,	offset?: number | undefined | null,	page?: number | undefined | null,	search?: string | undefined | null},ResolverInputTypes["verified_details"]],
verified_details_by_id?: [{	id: string},ResolverInputTypes["verified_details"]],
verified_details_aggregated?: [{	groupBy?: Array<string | undefined | null> | undefined | null,	filter?: ResolverInputTypes["verified_details_filter"] | undefined | null,	limit?: number | undefined | null,	search?: string | undefined | null,	sort?: Array<string | undefined | null> | undefined | null},ResolverInputTypes["verified_details_aggregated"]],
certificates?: [{	filter?: ResolverInputTypes["certificates_filter"] | undefined | null,	sort?: Array<string | undefined | null> | undefined | null,	limit?: number | undefined | null,	offset?: number | undefined | null,	page?: number | undefined | null,	search?: string | undefined | null},ResolverInputTypes["certificates"]],
certificates_by_id?: [{	id: string},ResolverInputTypes["certificates"]],
certificates_aggregated?: [{	groupBy?: Array<string | undefined | null> | undefined | null,	filter?: ResolverInputTypes["certificates_filter"] | undefined | null,	limit?: number | undefined | null,	search?: string | undefined | null,	sort?: Array<string | undefined | null> | undefined | null},ResolverInputTypes["certificates_aggregated"]],
student_login?: [{	filter?: ResolverInputTypes["student_login_filter"] | undefined | null,	sort?: Array<string | undefined | null> | undefined | null,	limit?: number | undefined | null,	offset?: number | undefined | null,	page?: number | undefined | null,	search?: string | undefined | null},ResolverInputTypes["student_login"]],
student_login_by_id?: [{	id: string},ResolverInputTypes["student_login"]],
student_login_aggregated?: [{	groupBy?: Array<string | undefined | null> | undefined | null,	filter?: ResolverInputTypes["student_login_filter"] | undefined | null,	limit?: number | undefined | null,	search?: string | undefined | null,	sort?: Array<string | undefined | null> | undefined | null},ResolverInputTypes["student_login_aggregated"]],
		__typename?: boolean | `@${string}`
}>;
	["string_filter_operators"]: {
	_eq?: string | undefined | null,
	_neq?: string | undefined | null,
	_contains?: string | undefined | null,
	_icontains?: string | undefined | null,
	_ncontains?: string | undefined | null,
	_starts_with?: string | undefined | null,
	_nstarts_with?: string | undefined | null,
	_ends_with?: string | undefined | null,
	_nends_with?: string | undefined | null,
	_in?: Array<string | undefined | null> | undefined | null,
	_nin?: Array<string | undefined | null> | undefined | null,
	_null?: boolean | undefined | null,
	_nnull?: boolean | undefined | null,
	_empty?: boolean | undefined | null,
	_nempty?: boolean | undefined | null
};
	["student_login"]: AliasType<{
	id?:boolean | `@${string}`,
	date_created?:boolean | `@${string}`,
	date_created_func?:ResolverInputTypes["datetime_functions"],
	email?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	ic?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["student_login_aggregated"]: AliasType<{
	group?:boolean | `@${string}`,
	countAll?:boolean | `@${string}`,
	count?:ResolverInputTypes["student_login_aggregated_count"],
	countDistinct?:ResolverInputTypes["student_login_aggregated_count"],
		__typename?: boolean | `@${string}`
}>;
	["student_login_aggregated_count"]: AliasType<{
	id?:boolean | `@${string}`,
	date_created?:boolean | `@${string}`,
	email?:boolean | `@${string}`,
	phone?:boolean | `@${string}`,
	ic?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["student_login_filter"]: {
	id?: ResolverInputTypes["string_filter_operators"] | undefined | null,
	date_created?: ResolverInputTypes["date_filter_operators"] | undefined | null,
	date_created_func?: ResolverInputTypes["datetime_function_filter_operators"] | undefined | null,
	email?: ResolverInputTypes["string_filter_operators"] | undefined | null,
	phone?: ResolverInputTypes["string_filter_operators"] | undefined | null,
	ic?: ResolverInputTypes["string_filter_operators"] | undefined | null,
	_and?: Array<ResolverInputTypes["student_login_filter"] | undefined | null> | undefined | null,
	_or?: Array<ResolverInputTypes["student_login_filter"] | undefined | null> | undefined | null
};
	["update_certificates_input"]: {
	id?: string | undefined | null,
	user_created?: string | undefined | null,
	date_created?: ResolverInputTypes["Date"] | undefined | null,
	date_updated?: ResolverInputTypes["Date"] | undefined | null,
	full_name?: string | undefined | null,
	ic?: string | undefined | null,
	phone?: string | undefined | null,
	/** CDA Number / DM number / PM number */
	cda_number?: string | undefined | null,
	total_days?: number | undefined | null,
	test_score?: string | undefined | null,
	marks?: string | undefined | null,
	location?: string | undefined | null,
	course?: string | undefined | null,
	course_start_date?: string | undefined | null,
	course_end_date?: string | undefined | null,
	/** Email of the certificate holder */
	email?: string | undefined | null,
	certificate?: string | undefined | null,
	number_title?: string | undefined | null,
	position?: string | undefined | null
};
	["update_student_login_input"]: {
	id?: string | undefined | null,
	date_created?: ResolverInputTypes["Date"] | undefined | null,
	email?: string | undefined | null,
	phone?: string | undefined | null,
	ic?: string | undefined | null
};
	["update_verified_details_input"]: {
	id?: string | undefined | null,
	user_created?: string | undefined | null,
	date_created?: ResolverInputTypes["Date"] | undefined | null,
	date_updated?: ResolverInputTypes["Date"] | undefined | null,
	/** Email of the person who wanted to verify the certificate */
	email?: string | undefined | null,
	/** Phone number of the person who wanted to verify the certificate */
	phone?: string | undefined | null,
	/** Organization of the person */
	organization?: string | undefined | null,
	/** Certificate number to be verified */
	certificate_number?: string | undefined | null,
	verified?: boolean | undefined | null
};
	["verified_details"]: AliasType<{
	id?:boolean | `@${string}`,
	user_created?:boolean | `@${string}`,
	date_created?:boolean | `@${string}`,
	date_created_func?:ResolverInputTypes["datetime_functions"],
	date_updated?:boolean | `@${string}`,
	date_updated_func?:ResolverInputTypes["datetime_functions"],
	/** Email of the person who wanted to verify the certificate */
	email?:boolean | `@${string}`,
	/** Phone number of the person who wanted to verify the certificate */
	phone?:boolean | `@${string}`,
	/** Organization of the person */
	organization?:boolean | `@${string}`,
	/** Certificate number to be verified */
	certificate_number?:boolean | `@${string}`,
	verified?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["verified_details_aggregated"]: AliasType<{
	group?:boolean | `@${string}`,
	countAll?:boolean | `@${string}`,
	count?:ResolverInputTypes["verified_details_aggregated_count"],
	countDistinct?:ResolverInputTypes["verified_details_aggregated_count"],
		__typename?: boolean | `@${string}`
}>;
	["verified_details_aggregated_count"]: AliasType<{
	id?:boolean | `@${string}`,
	user_created?:boolean | `@${string}`,
	date_created?:boolean | `@${string}`,
	date_updated?:boolean | `@${string}`,
	/** Email of the person who wanted to verify the certificate */
	email?:boolean | `@${string}`,
	/** Phone number of the person who wanted to verify the certificate */
	phone?:boolean | `@${string}`,
	/** Organization of the person */
	organization?:boolean | `@${string}`,
	/** Certificate number to be verified */
	certificate_number?:boolean | `@${string}`,
	verified?:boolean | `@${string}`,
		__typename?: boolean | `@${string}`
}>;
	["verified_details_filter"]: {
	id?: ResolverInputTypes["string_filter_operators"] | undefined | null,
	user_created?: ResolverInputTypes["string_filter_operators"] | undefined | null,
	date_created?: ResolverInputTypes["date_filter_operators"] | undefined | null,
	date_created_func?: ResolverInputTypes["datetime_function_filter_operators"] | undefined | null,
	date_updated?: ResolverInputTypes["date_filter_operators"] | undefined | null,
	date_updated_func?: ResolverInputTypes["datetime_function_filter_operators"] | undefined | null,
	email?: ResolverInputTypes["string_filter_operators"] | undefined | null,
	phone?: ResolverInputTypes["string_filter_operators"] | undefined | null,
	organization?: ResolverInputTypes["string_filter_operators"] | undefined | null,
	certificate_number?: ResolverInputTypes["string_filter_operators"] | undefined | null,
	verified?: ResolverInputTypes["boolean_filter_operators"] | undefined | null,
	_and?: Array<ResolverInputTypes["verified_details_filter"] | undefined | null> | undefined | null,
	_or?: Array<ResolverInputTypes["verified_details_filter"] | undefined | null> | undefined | null
}
  }

export type ModelTypes = {
    ["boolean_filter_operators"]: {
	_eq?: boolean | undefined,
	_neq?: boolean | undefined,
	_null?: boolean | undefined,
	_nnull?: boolean | undefined
};
	["certificates"]: {
		id: string,
	user_created?: string | undefined,
	date_created?: ModelTypes["Date"] | undefined,
	date_created_func?: ModelTypes["datetime_functions"] | undefined,
	date_updated?: ModelTypes["Date"] | undefined,
	date_updated_func?: ModelTypes["datetime_functions"] | undefined,
	full_name?: string | undefined,
	ic?: string | undefined,
	phone?: string | undefined,
	/** CDA Number / DM number / PM number */
	cda_number?: string | undefined,
	total_days?: number | undefined,
	test_score?: string | undefined,
	marks?: string | undefined,
	location?: string | undefined,
	course?: string | undefined,
	course_start_date?: string | undefined,
	course_end_date?: string | undefined,
	/** Email of the certificate holder */
	email?: string | undefined,
	certificate?: string | undefined,
	number_title?: string | undefined,
	position?: string | undefined
};
	["certificates_aggregated"]: {
		group?: ModelTypes["JSON"] | undefined,
	countAll?: number | undefined,
	count?: ModelTypes["certificates_aggregated_count"] | undefined,
	countDistinct?: ModelTypes["certificates_aggregated_count"] | undefined,
	avg?: ModelTypes["certificates_aggregated_fields"] | undefined,
	sum?: ModelTypes["certificates_aggregated_fields"] | undefined,
	avgDistinct?: ModelTypes["certificates_aggregated_fields"] | undefined,
	sumDistinct?: ModelTypes["certificates_aggregated_fields"] | undefined,
	min?: ModelTypes["certificates_aggregated_fields"] | undefined,
	max?: ModelTypes["certificates_aggregated_fields"] | undefined
};
	["certificates_aggregated_count"]: {
		id?: number | undefined,
	user_created?: number | undefined,
	date_created?: number | undefined,
	date_updated?: number | undefined,
	full_name?: number | undefined,
	ic?: number | undefined,
	phone?: number | undefined,
	/** CDA Number / DM number / PM number */
	cda_number?: number | undefined,
	total_days?: number | undefined,
	test_score?: number | undefined,
	marks?: number | undefined,
	location?: number | undefined,
	course?: number | undefined,
	course_start_date?: number | undefined,
	course_end_date?: number | undefined,
	/** Email of the certificate holder */
	email?: number | undefined,
	certificate?: number | undefined,
	number_title?: number | undefined,
	position?: number | undefined
};
	["certificates_aggregated_fields"]: {
		total_days?: number | undefined
};
	["certificates_filter"]: {
	id?: ModelTypes["string_filter_operators"] | undefined,
	user_created?: ModelTypes["string_filter_operators"] | undefined,
	date_created?: ModelTypes["date_filter_operators"] | undefined,
	date_created_func?: ModelTypes["datetime_function_filter_operators"] | undefined,
	date_updated?: ModelTypes["date_filter_operators"] | undefined,
	date_updated_func?: ModelTypes["datetime_function_filter_operators"] | undefined,
	full_name?: ModelTypes["string_filter_operators"] | undefined,
	ic?: ModelTypes["string_filter_operators"] | undefined,
	phone?: ModelTypes["string_filter_operators"] | undefined,
	cda_number?: ModelTypes["string_filter_operators"] | undefined,
	total_days?: ModelTypes["number_filter_operators"] | undefined,
	test_score?: ModelTypes["string_filter_operators"] | undefined,
	marks?: ModelTypes["string_filter_operators"] | undefined,
	location?: ModelTypes["string_filter_operators"] | undefined,
	course?: ModelTypes["string_filter_operators"] | undefined,
	course_start_date?: ModelTypes["string_filter_operators"] | undefined,
	course_end_date?: ModelTypes["string_filter_operators"] | undefined,
	email?: ModelTypes["string_filter_operators"] | undefined,
	certificate?: ModelTypes["string_filter_operators"] | undefined,
	number_title?: ModelTypes["string_filter_operators"] | undefined,
	position?: ModelTypes["string_filter_operators"] | undefined,
	_and?: Array<ModelTypes["certificates_filter"] | undefined> | undefined,
	_or?: Array<ModelTypes["certificates_filter"] | undefined> | undefined
};
	["create_student_login_input"]: {
	id?: string | undefined,
	date_created?: ModelTypes["Date"] | undefined,
	email?: string | undefined,
	phone?: string | undefined,
	ic?: string | undefined
};
	["create_verified_details_input"]: {
	id?: string | undefined,
	user_created?: string | undefined,
	date_created?: ModelTypes["Date"] | undefined,
	date_updated?: ModelTypes["Date"] | undefined,
	/** Email of the person who wanted to verify the certificate */
	email?: string | undefined,
	/** Phone number of the person who wanted to verify the certificate */
	phone?: string | undefined,
	/** Organization of the person */
	organization?: string | undefined,
	/** Certificate number to be verified */
	certificate_number?: string | undefined,
	verified?: boolean | undefined
};
	/** ISO8601 Date values */
["Date"]:any;
	["date_filter_operators"]: {
	_eq?: string | undefined,
	_neq?: string | undefined,
	_gt?: string | undefined,
	_gte?: string | undefined,
	_lt?: string | undefined,
	_lte?: string | undefined,
	_null?: boolean | undefined,
	_nnull?: boolean | undefined,
	_in?: Array<string | undefined> | undefined,
	_nin?: Array<string | undefined> | undefined,
	_between?: Array<ModelTypes["GraphQLStringOrFloat"] | undefined> | undefined,
	_nbetween?: Array<ModelTypes["GraphQLStringOrFloat"] | undefined> | undefined
};
	["datetime_function_filter_operators"]: {
	year?: ModelTypes["number_filter_operators"] | undefined,
	month?: ModelTypes["number_filter_operators"] | undefined,
	week?: ModelTypes["number_filter_operators"] | undefined,
	day?: ModelTypes["number_filter_operators"] | undefined,
	weekday?: ModelTypes["number_filter_operators"] | undefined,
	hour?: ModelTypes["number_filter_operators"] | undefined,
	minute?: ModelTypes["number_filter_operators"] | undefined,
	second?: ModelTypes["number_filter_operators"] | undefined
};
	["datetime_functions"]: {
		year?: number | undefined,
	month?: number | undefined,
	week?: number | undefined,
	day?: number | undefined,
	weekday?: number | undefined,
	hour?: number | undefined,
	minute?: number | undefined,
	second?: number | undefined
};
	/** A Float or a String */
["GraphQLStringOrFloat"]:any;
	/** The `JSON` scalar type represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
["JSON"]:any;
	["Mutation"]: {
		create_verified_details_items: Array<ModelTypes["verified_details"]>,
	create_verified_details_item?: ModelTypes["verified_details"] | undefined,
	create_student_login_items: Array<ModelTypes["student_login"]>,
	create_student_login_item?: ModelTypes["student_login"] | undefined,
	update_verified_details_items: Array<ModelTypes["verified_details"]>,
	update_verified_details_batch: Array<ModelTypes["verified_details"]>,
	update_verified_details_item?: ModelTypes["verified_details"] | undefined,
	update_certificates_items: Array<ModelTypes["certificates"]>,
	update_certificates_batch: Array<ModelTypes["certificates"]>,
	update_certificates_item?: ModelTypes["certificates"] | undefined,
	update_student_login_items: Array<ModelTypes["student_login"]>,
	update_student_login_batch: Array<ModelTypes["student_login"]>,
	update_student_login_item?: ModelTypes["student_login"] | undefined
};
	["number_filter_operators"]: {
	_eq?: ModelTypes["GraphQLStringOrFloat"] | undefined,
	_neq?: ModelTypes["GraphQLStringOrFloat"] | undefined,
	_in?: Array<ModelTypes["GraphQLStringOrFloat"] | undefined> | undefined,
	_nin?: Array<ModelTypes["GraphQLStringOrFloat"] | undefined> | undefined,
	_gt?: ModelTypes["GraphQLStringOrFloat"] | undefined,
	_gte?: ModelTypes["GraphQLStringOrFloat"] | undefined,
	_lt?: ModelTypes["GraphQLStringOrFloat"] | undefined,
	_lte?: ModelTypes["GraphQLStringOrFloat"] | undefined,
	_null?: boolean | undefined,
	_nnull?: boolean | undefined,
	_between?: Array<ModelTypes["GraphQLStringOrFloat"] | undefined> | undefined,
	_nbetween?: Array<ModelTypes["GraphQLStringOrFloat"] | undefined> | undefined
};
	["Query"]: {
		verified_details: Array<ModelTypes["verified_details"]>,
	verified_details_by_id?: ModelTypes["verified_details"] | undefined,
	verified_details_aggregated: Array<ModelTypes["verified_details_aggregated"]>,
	certificates: Array<ModelTypes["certificates"]>,
	certificates_by_id?: ModelTypes["certificates"] | undefined,
	certificates_aggregated: Array<ModelTypes["certificates_aggregated"]>,
	student_login: Array<ModelTypes["student_login"]>,
	student_login_by_id?: ModelTypes["student_login"] | undefined,
	student_login_aggregated: Array<ModelTypes["student_login_aggregated"]>
};
	["string_filter_operators"]: {
	_eq?: string | undefined,
	_neq?: string | undefined,
	_contains?: string | undefined,
	_icontains?: string | undefined,
	_ncontains?: string | undefined,
	_starts_with?: string | undefined,
	_nstarts_with?: string | undefined,
	_ends_with?: string | undefined,
	_nends_with?: string | undefined,
	_in?: Array<string | undefined> | undefined,
	_nin?: Array<string | undefined> | undefined,
	_null?: boolean | undefined,
	_nnull?: boolean | undefined,
	_empty?: boolean | undefined,
	_nempty?: boolean | undefined
};
	["student_login"]: {
		id: string,
	date_created?: ModelTypes["Date"] | undefined,
	date_created_func?: ModelTypes["datetime_functions"] | undefined,
	email?: string | undefined,
	phone?: string | undefined,
	ic?: string | undefined
};
	["student_login_aggregated"]: {
		group?: ModelTypes["JSON"] | undefined,
	countAll?: number | undefined,
	count?: ModelTypes["student_login_aggregated_count"] | undefined,
	countDistinct?: ModelTypes["student_login_aggregated_count"] | undefined
};
	["student_login_aggregated_count"]: {
		id?: number | undefined,
	date_created?: number | undefined,
	email?: number | undefined,
	phone?: number | undefined,
	ic?: number | undefined
};
	["student_login_filter"]: {
	id?: ModelTypes["string_filter_operators"] | undefined,
	date_created?: ModelTypes["date_filter_operators"] | undefined,
	date_created_func?: ModelTypes["datetime_function_filter_operators"] | undefined,
	email?: ModelTypes["string_filter_operators"] | undefined,
	phone?: ModelTypes["string_filter_operators"] | undefined,
	ic?: ModelTypes["string_filter_operators"] | undefined,
	_and?: Array<ModelTypes["student_login_filter"] | undefined> | undefined,
	_or?: Array<ModelTypes["student_login_filter"] | undefined> | undefined
};
	["update_certificates_input"]: {
	id?: string | undefined,
	user_created?: string | undefined,
	date_created?: ModelTypes["Date"] | undefined,
	date_updated?: ModelTypes["Date"] | undefined,
	full_name?: string | undefined,
	ic?: string | undefined,
	phone?: string | undefined,
	/** CDA Number / DM number / PM number */
	cda_number?: string | undefined,
	total_days?: number | undefined,
	test_score?: string | undefined,
	marks?: string | undefined,
	location?: string | undefined,
	course?: string | undefined,
	course_start_date?: string | undefined,
	course_end_date?: string | undefined,
	/** Email of the certificate holder */
	email?: string | undefined,
	certificate?: string | undefined,
	number_title?: string | undefined,
	position?: string | undefined
};
	["update_student_login_input"]: {
	id?: string | undefined,
	date_created?: ModelTypes["Date"] | undefined,
	email?: string | undefined,
	phone?: string | undefined,
	ic?: string | undefined
};
	["update_verified_details_input"]: {
	id?: string | undefined,
	user_created?: string | undefined,
	date_created?: ModelTypes["Date"] | undefined,
	date_updated?: ModelTypes["Date"] | undefined,
	/** Email of the person who wanted to verify the certificate */
	email?: string | undefined,
	/** Phone number of the person who wanted to verify the certificate */
	phone?: string | undefined,
	/** Organization of the person */
	organization?: string | undefined,
	/** Certificate number to be verified */
	certificate_number?: string | undefined,
	verified?: boolean | undefined
};
	["verified_details"]: {
		id: string,
	user_created?: string | undefined,
	date_created?: ModelTypes["Date"] | undefined,
	date_created_func?: ModelTypes["datetime_functions"] | undefined,
	date_updated?: ModelTypes["Date"] | undefined,
	date_updated_func?: ModelTypes["datetime_functions"] | undefined,
	/** Email of the person who wanted to verify the certificate */
	email?: string | undefined,
	/** Phone number of the person who wanted to verify the certificate */
	phone?: string | undefined,
	/** Organization of the person */
	organization?: string | undefined,
	/** Certificate number to be verified */
	certificate_number?: string | undefined,
	verified?: boolean | undefined
};
	["verified_details_aggregated"]: {
		group?: ModelTypes["JSON"] | undefined,
	countAll?: number | undefined,
	count?: ModelTypes["verified_details_aggregated_count"] | undefined,
	countDistinct?: ModelTypes["verified_details_aggregated_count"] | undefined
};
	["verified_details_aggregated_count"]: {
		id?: number | undefined,
	user_created?: number | undefined,
	date_created?: number | undefined,
	date_updated?: number | undefined,
	/** Email of the person who wanted to verify the certificate */
	email?: number | undefined,
	/** Phone number of the person who wanted to verify the certificate */
	phone?: number | undefined,
	/** Organization of the person */
	organization?: number | undefined,
	/** Certificate number to be verified */
	certificate_number?: number | undefined,
	verified?: number | undefined
};
	["verified_details_filter"]: {
	id?: ModelTypes["string_filter_operators"] | undefined,
	user_created?: ModelTypes["string_filter_operators"] | undefined,
	date_created?: ModelTypes["date_filter_operators"] | undefined,
	date_created_func?: ModelTypes["datetime_function_filter_operators"] | undefined,
	date_updated?: ModelTypes["date_filter_operators"] | undefined,
	date_updated_func?: ModelTypes["datetime_function_filter_operators"] | undefined,
	email?: ModelTypes["string_filter_operators"] | undefined,
	phone?: ModelTypes["string_filter_operators"] | undefined,
	organization?: ModelTypes["string_filter_operators"] | undefined,
	certificate_number?: ModelTypes["string_filter_operators"] | undefined,
	verified?: ModelTypes["boolean_filter_operators"] | undefined,
	_and?: Array<ModelTypes["verified_details_filter"] | undefined> | undefined,
	_or?: Array<ModelTypes["verified_details_filter"] | undefined> | undefined
}
    }

export type GraphQLTypes = {
    ["boolean_filter_operators"]: {
		_eq?: boolean | undefined,
	_neq?: boolean | undefined,
	_null?: boolean | undefined,
	_nnull?: boolean | undefined
};
	["certificates"]: {
	__typename: "certificates",
	id: string,
	user_created?: string | undefined,
	date_created?: GraphQLTypes["Date"] | undefined,
	date_created_func?: GraphQLTypes["datetime_functions"] | undefined,
	date_updated?: GraphQLTypes["Date"] | undefined,
	date_updated_func?: GraphQLTypes["datetime_functions"] | undefined,
	full_name?: string | undefined,
	ic?: string | undefined,
	phone?: string | undefined,
	/** CDA Number / DM number / PM number */
	cda_number?: string | undefined,
	total_days?: number | undefined,
	test_score?: string | undefined,
	marks?: string | undefined,
	location?: string | undefined,
	course?: string | undefined,
	course_start_date?: string | undefined,
	course_end_date?: string | undefined,
	/** Email of the certificate holder */
	email?: string | undefined,
	certificate?: string | undefined,
	number_title?: string | undefined,
	position?: string | undefined
};
	["certificates_aggregated"]: {
	__typename: "certificates_aggregated",
	group?: GraphQLTypes["JSON"] | undefined,
	countAll?: number | undefined,
	count?: GraphQLTypes["certificates_aggregated_count"] | undefined,
	countDistinct?: GraphQLTypes["certificates_aggregated_count"] | undefined,
	avg?: GraphQLTypes["certificates_aggregated_fields"] | undefined,
	sum?: GraphQLTypes["certificates_aggregated_fields"] | undefined,
	avgDistinct?: GraphQLTypes["certificates_aggregated_fields"] | undefined,
	sumDistinct?: GraphQLTypes["certificates_aggregated_fields"] | undefined,
	min?: GraphQLTypes["certificates_aggregated_fields"] | undefined,
	max?: GraphQLTypes["certificates_aggregated_fields"] | undefined
};
	["certificates_aggregated_count"]: {
	__typename: "certificates_aggregated_count",
	id?: number | undefined,
	user_created?: number | undefined,
	date_created?: number | undefined,
	date_updated?: number | undefined,
	full_name?: number | undefined,
	ic?: number | undefined,
	phone?: number | undefined,
	/** CDA Number / DM number / PM number */
	cda_number?: number | undefined,
	total_days?: number | undefined,
	test_score?: number | undefined,
	marks?: number | undefined,
	location?: number | undefined,
	course?: number | undefined,
	course_start_date?: number | undefined,
	course_end_date?: number | undefined,
	/** Email of the certificate holder */
	email?: number | undefined,
	certificate?: number | undefined,
	number_title?: number | undefined,
	position?: number | undefined
};
	["certificates_aggregated_fields"]: {
	__typename: "certificates_aggregated_fields",
	total_days?: number | undefined
};
	["certificates_filter"]: {
		id?: GraphQLTypes["string_filter_operators"] | undefined,
	user_created?: GraphQLTypes["string_filter_operators"] | undefined,
	date_created?: GraphQLTypes["date_filter_operators"] | undefined,
	date_created_func?: GraphQLTypes["datetime_function_filter_operators"] | undefined,
	date_updated?: GraphQLTypes["date_filter_operators"] | undefined,
	date_updated_func?: GraphQLTypes["datetime_function_filter_operators"] | undefined,
	full_name?: GraphQLTypes["string_filter_operators"] | undefined,
	ic?: GraphQLTypes["string_filter_operators"] | undefined,
	phone?: GraphQLTypes["string_filter_operators"] | undefined,
	cda_number?: GraphQLTypes["string_filter_operators"] | undefined,
	total_days?: GraphQLTypes["number_filter_operators"] | undefined,
	test_score?: GraphQLTypes["string_filter_operators"] | undefined,
	marks?: GraphQLTypes["string_filter_operators"] | undefined,
	location?: GraphQLTypes["string_filter_operators"] | undefined,
	course?: GraphQLTypes["string_filter_operators"] | undefined,
	course_start_date?: GraphQLTypes["string_filter_operators"] | undefined,
	course_end_date?: GraphQLTypes["string_filter_operators"] | undefined,
	email?: GraphQLTypes["string_filter_operators"] | undefined,
	certificate?: GraphQLTypes["string_filter_operators"] | undefined,
	number_title?: GraphQLTypes["string_filter_operators"] | undefined,
	position?: GraphQLTypes["string_filter_operators"] | undefined,
	_and?: Array<GraphQLTypes["certificates_filter"] | undefined> | undefined,
	_or?: Array<GraphQLTypes["certificates_filter"] | undefined> | undefined
};
	["create_student_login_input"]: {
		id?: string | undefined,
	date_created?: GraphQLTypes["Date"] | undefined,
	email?: string | undefined,
	phone?: string | undefined,
	ic?: string | undefined
};
	["create_verified_details_input"]: {
		id?: string | undefined,
	user_created?: string | undefined,
	date_created?: GraphQLTypes["Date"] | undefined,
	date_updated?: GraphQLTypes["Date"] | undefined,
	/** Email of the person who wanted to verify the certificate */
	email?: string | undefined,
	/** Phone number of the person who wanted to verify the certificate */
	phone?: string | undefined,
	/** Organization of the person */
	organization?: string | undefined,
	/** Certificate number to be verified */
	certificate_number?: string | undefined,
	verified?: boolean | undefined
};
	/** ISO8601 Date values */
["Date"]: "scalar" & { name: "Date" };
	["date_filter_operators"]: {
		_eq?: string | undefined,
	_neq?: string | undefined,
	_gt?: string | undefined,
	_gte?: string | undefined,
	_lt?: string | undefined,
	_lte?: string | undefined,
	_null?: boolean | undefined,
	_nnull?: boolean | undefined,
	_in?: Array<string | undefined> | undefined,
	_nin?: Array<string | undefined> | undefined,
	_between?: Array<GraphQLTypes["GraphQLStringOrFloat"] | undefined> | undefined,
	_nbetween?: Array<GraphQLTypes["GraphQLStringOrFloat"] | undefined> | undefined
};
	["datetime_function_filter_operators"]: {
		year?: GraphQLTypes["number_filter_operators"] | undefined,
	month?: GraphQLTypes["number_filter_operators"] | undefined,
	week?: GraphQLTypes["number_filter_operators"] | undefined,
	day?: GraphQLTypes["number_filter_operators"] | undefined,
	weekday?: GraphQLTypes["number_filter_operators"] | undefined,
	hour?: GraphQLTypes["number_filter_operators"] | undefined,
	minute?: GraphQLTypes["number_filter_operators"] | undefined,
	second?: GraphQLTypes["number_filter_operators"] | undefined
};
	["datetime_functions"]: {
	__typename: "datetime_functions",
	year?: number | undefined,
	month?: number | undefined,
	week?: number | undefined,
	day?: number | undefined,
	weekday?: number | undefined,
	hour?: number | undefined,
	minute?: number | undefined,
	second?: number | undefined
};
	/** A Float or a String */
["GraphQLStringOrFloat"]: "scalar" & { name: "GraphQLStringOrFloat" };
	/** The `JSON` scalar type represents JSON values as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
["JSON"]: "scalar" & { name: "JSON" };
	["Mutation"]: {
	__typename: "Mutation",
	create_verified_details_items: Array<GraphQLTypes["verified_details"]>,
	create_verified_details_item?: GraphQLTypes["verified_details"] | undefined,
	create_student_login_items: Array<GraphQLTypes["student_login"]>,
	create_student_login_item?: GraphQLTypes["student_login"] | undefined,
	update_verified_details_items: Array<GraphQLTypes["verified_details"]>,
	update_verified_details_batch: Array<GraphQLTypes["verified_details"]>,
	update_verified_details_item?: GraphQLTypes["verified_details"] | undefined,
	update_certificates_items: Array<GraphQLTypes["certificates"]>,
	update_certificates_batch: Array<GraphQLTypes["certificates"]>,
	update_certificates_item?: GraphQLTypes["certificates"] | undefined,
	update_student_login_items: Array<GraphQLTypes["student_login"]>,
	update_student_login_batch: Array<GraphQLTypes["student_login"]>,
	update_student_login_item?: GraphQLTypes["student_login"] | undefined
};
	["number_filter_operators"]: {
		_eq?: GraphQLTypes["GraphQLStringOrFloat"] | undefined,
	_neq?: GraphQLTypes["GraphQLStringOrFloat"] | undefined,
	_in?: Array<GraphQLTypes["GraphQLStringOrFloat"] | undefined> | undefined,
	_nin?: Array<GraphQLTypes["GraphQLStringOrFloat"] | undefined> | undefined,
	_gt?: GraphQLTypes["GraphQLStringOrFloat"] | undefined,
	_gte?: GraphQLTypes["GraphQLStringOrFloat"] | undefined,
	_lt?: GraphQLTypes["GraphQLStringOrFloat"] | undefined,
	_lte?: GraphQLTypes["GraphQLStringOrFloat"] | undefined,
	_null?: boolean | undefined,
	_nnull?: boolean | undefined,
	_between?: Array<GraphQLTypes["GraphQLStringOrFloat"] | undefined> | undefined,
	_nbetween?: Array<GraphQLTypes["GraphQLStringOrFloat"] | undefined> | undefined
};
	["Query"]: {
	__typename: "Query",
	verified_details: Array<GraphQLTypes["verified_details"]>,
	verified_details_by_id?: GraphQLTypes["verified_details"] | undefined,
	verified_details_aggregated: Array<GraphQLTypes["verified_details_aggregated"]>,
	certificates: Array<GraphQLTypes["certificates"]>,
	certificates_by_id?: GraphQLTypes["certificates"] | undefined,
	certificates_aggregated: Array<GraphQLTypes["certificates_aggregated"]>,
	student_login: Array<GraphQLTypes["student_login"]>,
	student_login_by_id?: GraphQLTypes["student_login"] | undefined,
	student_login_aggregated: Array<GraphQLTypes["student_login_aggregated"]>
};
	["string_filter_operators"]: {
		_eq?: string | undefined,
	_neq?: string | undefined,
	_contains?: string | undefined,
	_icontains?: string | undefined,
	_ncontains?: string | undefined,
	_starts_with?: string | undefined,
	_nstarts_with?: string | undefined,
	_ends_with?: string | undefined,
	_nends_with?: string | undefined,
	_in?: Array<string | undefined> | undefined,
	_nin?: Array<string | undefined> | undefined,
	_null?: boolean | undefined,
	_nnull?: boolean | undefined,
	_empty?: boolean | undefined,
	_nempty?: boolean | undefined
};
	["student_login"]: {
	__typename: "student_login",
	id: string,
	date_created?: GraphQLTypes["Date"] | undefined,
	date_created_func?: GraphQLTypes["datetime_functions"] | undefined,
	email?: string | undefined,
	phone?: string | undefined,
	ic?: string | undefined
};
	["student_login_aggregated"]: {
	__typename: "student_login_aggregated",
	group?: GraphQLTypes["JSON"] | undefined,
	countAll?: number | undefined,
	count?: GraphQLTypes["student_login_aggregated_count"] | undefined,
	countDistinct?: GraphQLTypes["student_login_aggregated_count"] | undefined
};
	["student_login_aggregated_count"]: {
	__typename: "student_login_aggregated_count",
	id?: number | undefined,
	date_created?: number | undefined,
	email?: number | undefined,
	phone?: number | undefined,
	ic?: number | undefined
};
	["student_login_filter"]: {
		id?: GraphQLTypes["string_filter_operators"] | undefined,
	date_created?: GraphQLTypes["date_filter_operators"] | undefined,
	date_created_func?: GraphQLTypes["datetime_function_filter_operators"] | undefined,
	email?: GraphQLTypes["string_filter_operators"] | undefined,
	phone?: GraphQLTypes["string_filter_operators"] | undefined,
	ic?: GraphQLTypes["string_filter_operators"] | undefined,
	_and?: Array<GraphQLTypes["student_login_filter"] | undefined> | undefined,
	_or?: Array<GraphQLTypes["student_login_filter"] | undefined> | undefined
};
	["update_certificates_input"]: {
		id?: string | undefined,
	user_created?: string | undefined,
	date_created?: GraphQLTypes["Date"] | undefined,
	date_updated?: GraphQLTypes["Date"] | undefined,
	full_name?: string | undefined,
	ic?: string | undefined,
	phone?: string | undefined,
	/** CDA Number / DM number / PM number */
	cda_number?: string | undefined,
	total_days?: number | undefined,
	test_score?: string | undefined,
	marks?: string | undefined,
	location?: string | undefined,
	course?: string | undefined,
	course_start_date?: string | undefined,
	course_end_date?: string | undefined,
	/** Email of the certificate holder */
	email?: string | undefined,
	certificate?: string | undefined,
	number_title?: string | undefined,
	position?: string | undefined
};
	["update_student_login_input"]: {
		id?: string | undefined,
	date_created?: GraphQLTypes["Date"] | undefined,
	email?: string | undefined,
	phone?: string | undefined,
	ic?: string | undefined
};
	["update_verified_details_input"]: {
		id?: string | undefined,
	user_created?: string | undefined,
	date_created?: GraphQLTypes["Date"] | undefined,
	date_updated?: GraphQLTypes["Date"] | undefined,
	/** Email of the person who wanted to verify the certificate */
	email?: string | undefined,
	/** Phone number of the person who wanted to verify the certificate */
	phone?: string | undefined,
	/** Organization of the person */
	organization?: string | undefined,
	/** Certificate number to be verified */
	certificate_number?: string | undefined,
	verified?: boolean | undefined
};
	["verified_details"]: {
	__typename: "verified_details",
	id: string,
	user_created?: string | undefined,
	date_created?: GraphQLTypes["Date"] | undefined,
	date_created_func?: GraphQLTypes["datetime_functions"] | undefined,
	date_updated?: GraphQLTypes["Date"] | undefined,
	date_updated_func?: GraphQLTypes["datetime_functions"] | undefined,
	/** Email of the person who wanted to verify the certificate */
	email?: string | undefined,
	/** Phone number of the person who wanted to verify the certificate */
	phone?: string | undefined,
	/** Organization of the person */
	organization?: string | undefined,
	/** Certificate number to be verified */
	certificate_number?: string | undefined,
	verified?: boolean | undefined
};
	["verified_details_aggregated"]: {
	__typename: "verified_details_aggregated",
	group?: GraphQLTypes["JSON"] | undefined,
	countAll?: number | undefined,
	count?: GraphQLTypes["verified_details_aggregated_count"] | undefined,
	countDistinct?: GraphQLTypes["verified_details_aggregated_count"] | undefined
};
	["verified_details_aggregated_count"]: {
	__typename: "verified_details_aggregated_count",
	id?: number | undefined,
	user_created?: number | undefined,
	date_created?: number | undefined,
	date_updated?: number | undefined,
	/** Email of the person who wanted to verify the certificate */
	email?: number | undefined,
	/** Phone number of the person who wanted to verify the certificate */
	phone?: number | undefined,
	/** Organization of the person */
	organization?: number | undefined,
	/** Certificate number to be verified */
	certificate_number?: number | undefined,
	verified?: number | undefined
};
	["verified_details_filter"]: {
		id?: GraphQLTypes["string_filter_operators"] | undefined,
	user_created?: GraphQLTypes["string_filter_operators"] | undefined,
	date_created?: GraphQLTypes["date_filter_operators"] | undefined,
	date_created_func?: GraphQLTypes["datetime_function_filter_operators"] | undefined,
	date_updated?: GraphQLTypes["date_filter_operators"] | undefined,
	date_updated_func?: GraphQLTypes["datetime_function_filter_operators"] | undefined,
	email?: GraphQLTypes["string_filter_operators"] | undefined,
	phone?: GraphQLTypes["string_filter_operators"] | undefined,
	organization?: GraphQLTypes["string_filter_operators"] | undefined,
	certificate_number?: GraphQLTypes["string_filter_operators"] | undefined,
	verified?: GraphQLTypes["boolean_filter_operators"] | undefined,
	_and?: Array<GraphQLTypes["verified_details_filter"] | undefined> | undefined,
	_or?: Array<GraphQLTypes["verified_details_filter"] | undefined> | undefined
}
    }


type ZEUS_VARIABLES = {
	["boolean_filter_operators"]: ValueTypes["boolean_filter_operators"];
	["certificates_filter"]: ValueTypes["certificates_filter"];
	["create_student_login_input"]: ValueTypes["create_student_login_input"];
	["create_verified_details_input"]: ValueTypes["create_verified_details_input"];
	["Date"]: ValueTypes["Date"];
	["date_filter_operators"]: ValueTypes["date_filter_operators"];
	["datetime_function_filter_operators"]: ValueTypes["datetime_function_filter_operators"];
	["GraphQLStringOrFloat"]: ValueTypes["GraphQLStringOrFloat"];
	["JSON"]: ValueTypes["JSON"];
	["number_filter_operators"]: ValueTypes["number_filter_operators"];
	["string_filter_operators"]: ValueTypes["string_filter_operators"];
	["student_login_filter"]: ValueTypes["student_login_filter"];
	["update_certificates_input"]: ValueTypes["update_certificates_input"];
	["update_student_login_input"]: ValueTypes["update_student_login_input"];
	["update_verified_details_input"]: ValueTypes["update_verified_details_input"];
	["verified_details_filter"]: ValueTypes["verified_details_filter"];
}