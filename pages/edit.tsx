import dynamic from "next/dynamic";
import Head from "next/head";
import Router from "next/router";
import { FormEvent, useEffect, useState } from "react";
import { chain } from "utils";


const DynamicPDF = dynamic(() => import("../components/PDF"), {
    ssr: false
});

const Edit = () => {

    const [certificate, setCertificate] = useState<any>({
        cda_number: "",
        course: "",
        course_start_date: "",
        course_end_date: "",
        full_name: "",
        ic: "",
        location: "",
        id: "",
        marks: "",
        phone: "",
        total_days: ""
    });
    const [name, setName] = useState<{ value: string; state: "init" | "success" | "loading" }>({ value: "", state: "init" });
    const [phone, setPhone] = useState<{ value: string; state: "init" | "success" | "loading" }>({ value: "", state: "init" });

    const getCertificate = async (id: string) => {
        const certificateQ = await chain("query")({
            certificates_by_id: [
                {
                    id: id
                },
                {
                    cda_number: true,
                    course: true,
                    course_start_date: true,
                    course_end_date: true,
                    full_name: true,
                    ic: true,
                    location: true,
                    id: true,
                    marks: true,
                    phone: true,
                    total_days: true,
                    certificate: true,
                    number_title: true,
                    position: true
                }
            ]
        });
        if (certificateQ.certificates_by_id === null) {
            Router.push("/");
            return;
        };
        setCertificate(certificateQ.certificates_by_id);
        setName(x => { return { value: certificateQ.certificates_by_id?.full_name || "", state: "init" } });
        setPhone(x => { return { value: certificateQ.certificates_by_id?.phone || "", state: "init" } });
    };

    useEffect(() => {
        const auth = localStorage.getItem("loginAuth");
        if (auth) {
            const decodedAuth = decodeURI(auth);
            getCertificate(decodedAuth);
            return;
        } else {
            Router.push("/");
            return;
        };
    }, []);


    const changeName = async (e: FormEvent) => {
        e.preventDefault();
        setName(n => { return { value: n.value, state: "loading" } });
        const changeNameObj = await chain("mutation")({
            update_certificates_item: [
                {
                    id: certificate.id,
                    data: {
                        full_name: name.value
                    }
                },
                {
                    id: true
                }
            ]
        });
        setName(n => { return { value: n.value, state: "success" } });
        setTimeout(() => {
            setName(n => { return { value: n.value, state: "init" } });
        }, 500);
    };

    const changePhone = async (e: FormEvent) => {
        e.preventDefault();
        setPhone(n => { return { value: n.value, state: "loading" } });
        const changeNameObj = await chain("mutation")({
            update_certificates_item: [
                {
                    id: certificate.id,
                    data: {
                        phone: phone.value
                    }
                },
                {
                    id: true
                }
            ]
        });
        setPhone(n => { return { value: n.value, state: "success" } });
        setTimeout(() => {
            setPhone(n => { return { value: n.value, state: "init" } });
        }, 500);
    };

    return (
        <div>
            <Head>
                <title>
                    Edit your certificate
                </title>
            </Head>
            <div className="min-h-screen w-full bg-violet-100 py-10" >
                <div className="lg:container mx-auto bg-white shadow-md p-6 rounded-md" >

                    <h1 className="text-4xl font-semibold my-3" >Edit certificate details</h1>
                    {
                        certificate.cda_number.length === 0 &&
                        <div className="flex justify-center" >
                            <svg aria-hidden="true" className="block w-10 h-10 mr-2 text-gray-200 animate-spin fill-blue-600" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor" />
                                <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill" />
                            </svg>
                        </div>
                    }

                    {certificate.cda_number.length !== 0 &&
                        <div>
                            <div className="bg-yellow-200 px-4 py-2 inline-block rounded-sm text-2xl font-bold my-3" >
                                <span className="font-normal mr-2" >
                                    Certificate Number:
                                </span>
                                <span>
                                    {certificate.ic}
                                </span>
                            </div>
                            <div>
                                <div>
                                    <p className="text-lg" >
                                        Certificate for {certificate.course} course counducted from {certificate.course_start_date} to {certificate.course_end_date}
                                    </p>
                                    <p className="text-lg" >
                                        Location:  {certificate.location}
                                    </p>
                                </div>
                                <form onClick={changeName} className="flex font-light mt-6 px-4 gap-x-3 lg:w-1/2" >
                                    <p className="block my-auto text-lg" >
                                        Name
                                    </p>
                                    <input
                                        type="text"
                                        name="text"
                                        id="text"
                                        required
                                        value={name.value}
                                        onChange={e => { setName({ state: "init", value: e.target.value }) }}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                    />
                                    <button type="submit" className="block py-1 px-2 bg-emerald-400 hover:bg-emerald-500 shadow-sm rounded-md " >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </button>
                                    <button type="button" onClick={e => { e.preventDefault(); setName({ state: "init", value: certificate.full_name }); }} className="hover:cursor-pointer block py-1 px-2 bg-red-300 hover:bg-red-400 shadow-sm rounded-md " >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </button>
                                </form>
                                <form onSubmit={changePhone} className="flex font-light mt-6 px-4 gap-x-3 lg:w-1/2" >
                                    <p className="block my-auto text-lg" >
                                        Phone
                                    </p>
                                    <input
                                        type="tel"
                                        name="phone"
                                        id="phone"
                                        required
                                        value={phone.value}
                                        onChange={e => setPhone({ state: "init", value: e.target.value })}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                    />
                                    <button type="submit" className="block py-1 px-2 bg-emerald-400 hover:bg-emerald-500 shadow-sm rounded-md " >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </button>
                                    <button onClick={e => { e.preventDefault(); setPhone({ state: "init", value: certificate.phone }); }} className="block py-1 px-2 bg-red-300 hover:bg-red-400 shadow-sm rounded-md " >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </button>
                                </form>
                            </div>
                            <div className="mt-3" >
                                <DynamicPDF cds={certificate.cda_number || ""} course={certificate.course || ""} endDate={certificate.course_end_date || ""} startDate={certificate.course_start_date || ""} name={certificate.full_name || ""} certificate={certificate.certificate || ""} position={ certificate.position || ""} number_title={certificate.number_title || ""} />
                            </div>
                        </div>}

                </div>
            </div>


        </div>
    );
};

export default Edit;