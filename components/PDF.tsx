/* eslint-disable jsx-a11y/alt-text */
import { Page, Text, View, Document, StyleSheet, Image, PDFDownloadLink } from '@react-pdf/renderer';
import { useEffect, useState } from 'react';

interface ICertificateType {
    name: string
    course: string
    startDate: string
    endDate: string
    cds: string
    certificate: string
    position: string
    number_title: string
};

const pdfModes = {
    cambridge: {
        bgImage: "/new_cambridge.jpg",
        nameNode: {
            viewTop: "38%",
            fontSize: "30"
        },
        course: {
            present: true,
            viewTop: "53%",
            fontSize: "23"
        },
        position: {
            viewTop: "60%",
            fontSize: "15"
        },
        dates: {
            present: false,
            fontSize: "15",
            viewTop: "53.1%"
        },
        grantDate: {
            fontSize: "15",
            viewTop: "64%",
            marginLeft: "160"
        },
        cds: {
            fontSize: "15",
            viewTop: "67.3%"
        }
    },
    ccsd: {
        bgImage: "/ccsd.jpeg",
        nameNode: {
            viewTop: "36%",
            fontSize: "25"
        },
        course: {
            present: true,
            viewTop: "49.1%",
            fontSize: "20"
        },
        position: {
            viewTop: "55%",
            fontSize: "17"
        },
        dates: {
            present: false,
            fontSize: "15",
            viewTop: "55%"
        },
        grantDate: {
            fontSize: "15",
            viewTop: "57.7%",
            marginLeft: "230"
        },
        cds: {
            fontSize: "15",
            viewTop: "60.2%",
            marginLeft: "0"
        }
    },
    cambridgeProfessionals: {
        bgImage: "/cambridge_professionals.jpeg",
        nameNode: {
            viewTop: "39%",
            fontSize: "25"
        },
        course: {
            present: true,
            viewTop: "53.4%",
            fontSize: "20"
        },
        position: {
            viewTop: "59.9%",
            fontSize: "17"
        },
        dates: {
            present: false,
            fontSize: "15",
            viewTop: "55%"
        },
        grantDate: {
            fontSize: "15",
            viewTop: "63%",
            marginLeft: "235"
        },
        cds: {
            fontSize: "15",
            viewTop: "65.4%",
            marginLeft: "0"
        }
    },
    cpa: {
        bgImage: "/cpa.jpeg",
        nameNode: {
            viewTop: "37%",
            fontSize: "25"
        },
        course: {
            present: true,
            viewTop: "53.4%",
            fontSize: "20"
        },
        position: {
            viewTop: "59.9%",
            fontSize: "17"
        },
        dates: {
            present: false,
            fontSize: "15",
            viewTop: "55%"
        },
        grantDate: {
            fontSize: "15",
            viewTop: "64.5%",
            marginLeft: "244"
        },
        cds: {
            fontSize: "15",
            viewTop: "67%",
            marginLeft: "0"
        }
    },
    tui: {
        bgImage: "/tui.png",
        nameNode: {
            viewLeft: "4%",
            viewTop: "35%",
            fontSize: "25"
        },
        course: {
            present: true,
            viewLeft: "2%",
            viewTop: "50.5%",
            fontSize: "20"
        },
        position: {
            viewTop: "61%",
            fontSize: "17"
        },
        dates: {
            present: false,
            fontSize: "15",
            viewTop: "55%"
        },
        grantDate: {
            fontSize: "14",
            viewLeft: "17%",
            viewTop: "64.5%"
        },
        cds: {
            fontSize: "15",
            viewTop: "66.5%",
            marginLeft: "0"
        }
    },
    til: {
        bgImage: "/til.png",
        nameNode: {
            viewLeft: "4%",
            viewTop: "38%",
            fontSize: "25"
        },
        course: {
            present: true,
            viewLeft: "2%",
            viewTop: "52%",
            fontSize: "20"
        },
        position: {
            viewLeft: "2%",
            viewTop: "62%",
            fontSize: "17"
        },
        dates: {
            present: false,
            viewLeft: "4%",
            fontSize: "15",
            viewTop: "55%"
        },
        grantDate: {
            fontSize: "15",
            viewLeft: "6.5%",
            viewTop: "68.5%"
        },
        cds: {
            fontSize: "15",
            viewLeft: "-3.8%",
            viewTop: "70.5%"
        }
    },
    CambridgeLans: {
        bgImage: "/CambridgeLans.png",
        orientation: "landscape",
        nameNode: {
            viewLeft: "0%",
            viewTop: "36%",
            fontSize: "25"
        },
        course: {
            present: true,
            viewLeft: "0%",
            viewTop: "53%",
            fontSize: "20"
        },
        position: {
            viewLeft: "0%",
            viewTop: "63%",
            fontSize: "17"
        },
        dates: {
            present: false,
            fontSize: "15",
            viewLeft: "0%",
            viewTop: "80%"
        },
        grantDate: {
            fontSize: "15",
            viewLeft: "8%",
            viewTop: "68%"
        },
        cds: {
            fontSize: "15",
            viewLeft: "0%",
            viewTop: "71.5%"
        }
    },
};


const CertificatePDF = ({
    name, course, startDate, endDate, cds, certificate, position, number_title
}: ICertificateType) => {

    const [ctx, setCtx] = useState<any>(pdfModes.ccsd);
    useEffect(() => {

        switch (certificate) {
            case "CCSD":
                setCtx(pdfModes.ccsd);
                break;

            case "Cambridge":
                setCtx(pdfModes.cambridge);
                break;

            case "CambridgeProfessionals":
                setCtx(pdfModes.cambridgeProfessionals)
                break;

            case "CPA":
                setCtx(pdfModes.cpa)
                break;

            case "TUI":
                setCtx(pdfModes.tui)
                break;

            case "TIL":
                setCtx(pdfModes.til)
                break;

            case "CambridgeLans":
                setCtx(pdfModes.CambridgeLans)
                break;

            default:
                break;
        }


    }, []);

    if (ctx === undefined) {
        return (
            <Document>
                <Page>
                    <View>
                        <Text>
                            Loading PDF
                        </Text>
                    </View>
                </Page>
            </Document>
        )
    };

    return (
        <Document>
            <Page size={"A4"} orientation={ctx.orientation ?? "portrait"} wrap={false} style={{ flexDirection: "row", backgroundColor: "#fff" }} >
                <View style={{ position: "relative", top: 0, height: "100%", width: "100%" }} >
                    <Image source={ctx.bgImage} src={ctx.bgImage} style={{ width: '100%', height: '100%' }} />
                    <View style={{
                        position: 'absolute',
                        left: ctx.nameNode.viewLeft ?? '0%',
                        top: ctx.nameNode.viewTop,
                        width: "100%"
                    }} >
                        <Text style={{
                            fontSize: ctx.nameNode.fontSize,
                            fontWeight: "bold",
                            textAlign: "center"
                        }} >
                            {name}
                        </Text>
                    </View>
                    {
                        ctx.course.present && <View style={{
                            position: 'absolute',
                            left: ctx.course.viewLeft ?? '0%',
                            top: ctx.course.viewTop,
                            width: "100%"
                        }} >
                            <Text style={{
                                fontSize: ctx.course.fontSize,
                                textAlign: "center"
                            }} >
                                {course}
                            </Text>
                        </View>
                    }

                    {
                        <View style={{
                            position: 'absolute',
                            left: ctx.position.viewLeft ?? ctx.position.marginLeft ?? "0%",
                            top: ctx.position.viewTop,
                            width: "100%"
                        }} >
                            <Text style={{
                                fontSize: ctx.position.fontSize,
                                textAlign: "center"
                            }} >
                                {position}
                            </Text>
                        </View>
                    }


                    {
                        ctx.dates.present && <View style={{
                            position: 'absolute',
                            left: ctx.dates.viewLeft ?? '0%',
                            top: ctx.dates.viewTop,
                            width: "100%"
                        }} >
                            <Text style={{
                                fontSize: ctx.dates.fontSize,
                                textAlign: "center"
                            }} >
                                {startDate} to {endDate}
                            </Text>
                        </View>
                    }



                    <View style={{
                        position: 'absolute',
                        left: ctx.grantDate.viewLeft ?? '0%',
                        top: ctx.grantDate.viewTop,
                        width: "100%"
                    }} >
                        <Text style={{
                            fontSize: ctx.grantDate.fontSize,
                            textAlign: "center",
                            marginLeft: ctx.grantDate.marginLeft
                        }} >
                            {endDate}
                        </Text>
                    </View>


                    <View style={{
                        position: 'absolute',
                        left: ctx.cds.viewLeft ?? '0%',
                        top: ctx.cds.viewTop,
                        width: "100%"
                    }} >
                        <Text style={{
                            fontSize: ctx.cds.fontSize,
                            textAlign: "center",
                            marginLeft: ctx.cds.marginLeft,
                            fontWeight: "bold"
                        }} >
                            {number_title} : {cds}
                        </Text>
                    </View>

                </View>
            </Page>
        </Document >
    );
};

const DownloadLink = (props: ICertificateType) => (
    <PDFDownloadLink className='bg-green-300 p-4 rounded-md inline-block hidden' fileName="certificate.pdf" document={<CertificatePDF {...props} />} >
        {({ blob, url, loading, error }) =>
            loading ? 'Loading document...' : "Download Certificate"
        }
    </PDFDownloadLink>
);

export default DownloadLink;
