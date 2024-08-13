import VerifyCertificate from "components/verify-certificate";

const Verify = () => {
    return (
        <div className='min-h-screen w-full bg-white flex flex-col justify-center'  >
            <div className="lg:w-2/3 w-full mx-auto">
                <VerifyCertificate />
            </div>
        </div>
    );
};


export default Verify;