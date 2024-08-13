import { GetServerSideProps, NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { chain } from "utils";
import { PDFDownloadLink, usePDF } from '@react-pdf/renderer';
import dynamic from "next/dynamic";


export const getServerSideProps: GetServerSideProps = async (ctx) => {
    const { id } = ctx.query;

    const verifyRequest = await chain("query")({
        verified_details_by_id: [
            {
                id: id as string
            },
            {
                certificate_number: true
            }
        ]
    });
    if (verifyRequest === undefined) {
        return {
            notFound: true
        };
    };

    const certificatesObj = await chain("query")({
        certificates: [
            {
                filter: {
                    cda_number: {
                        _eq: verifyRequest.verified_details_by_id?.certificate_number
                    }
                },
                limit: 1
            },
            {
                cda_number: true,
                id: true,
                full_name: true,
                course: true,
                course_end_date: true,
                course_start_date: true,
                marks: true,
                location: true,
                certificate: true,
                number_title: true,
                position: true
            }
        ]
    });

    if (certificatesObj.certificates.length === 0) {
        return {
            notFound: true
        };
    };

    return {
        props: {
            certificate: certificatesObj.certificates[0]
        }
    };
};

const DynamicPDF = dynamic(() => import("../../components/PDF"), {
    ssr: false
});


const Verify: NextPage<{
    certificate: {
        id: string;
        cda_number?: string | undefined;
        full_name?: string | undefined;
        course?: string | undefined;
        course_end_date?: string | undefined;
        course_start_date?: string | undefined;
        marks?: string | undefined;
        location?: string | undefined;
        certificate: string
        position: string
        number_title: string
    }
}> = ({ certificate }) => {

    return (
        <div className="flex flex-col justify-center h-screen bg-sky-100" >
            <div className="lg:container mx-auto py-10 px-6 my-auto bg-white shadow-md rounded-md" >
                <Head>
                    <title>
                        Certificate verified
                    </title>
                </Head>
                <h1 className="text-4xl font-bold text-center flex justify-center lg:gap-x-3" >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 block text-green-700">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                    <span className="text-gray-700" >
                        Certificate has been verified
                    </span>
                </h1>
                <div className="my-5 gap-y-3 flex flex-col text-lg text-gray-700 text-center" >
                    <p className="text-lg block" >
                        Certificate Issued to:
                        <span className="ml-2 text-xl text-gray-800" >
                            {certificate.full_name}
                        </span>
                    </p>
                    <p className="block" >
                        Certificate Number:
                        <span className="ml-2 text-xl text-gray-800">
                            {certificate.cda_number}
                        </span>
                    </p>
                    <p className="block" >
                        Course Title:
                        <span className="ml-2 text-xl text-gray-800">
                            {certificate.course}
                        </span>
                    </p>
                    <p className="block" >
                        Location:
                        <span className="ml-2 text-xl text-gray-800">
                            {certificate.location}
                        </span>
                    </p>
                    <p className="block" >
                        Course date:
                        <span className="ml-2 text-xl text-gray-800">
                            {certificate.course_start_date} to {certificate.course_end_date}
                        </span>
                    </p>
                </div>
                <div className="flex lg:flex-row flex-col justify-center gap-x-3" >
                    <Link href="/verify" className="print:hidden inline-block py-3 px-4 bg-purple-500 rounded-md text-gray-100 shadow-md" >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 inline mr-3">
                            <path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 101.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059-4.035.75.75 0 00-.53-.918z" clipRule="evenodd" />
                        </svg>
                        Verify another certificate
                    </Link>
                    <DynamicPDF cds={certificate.cda_number||""} course={certificate.course||""} endDate={certificate.course_end_date||""} startDate={certificate.course_start_date||""} name={certificate.full_name||""} certificate={certificate.certificate || ""} position={certificate.position || ""} number_title={certificate.number_title || ""} />
                </div>



            </div>
        </div>
    )
};

export default Verify;