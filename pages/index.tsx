import LoginModal from "components/login-modal";
import Head from "next/head";


export default function Home() {
  return (
    <main className='min-h-screen w-full bg-white' >
      <Head>
        <title>
          Certificate verification or Login
        </title>
      </Head>
      <div className='lg:container my-auto flex flex-col justify-center mx-auto min-h-screen' >
        <div className='flex justify-center lg:flex-row flex-col my-auto lg:gap-x-10 gap-y-4 p-3 lg:p-0' >
          <div className="w-full lg:w-2/3" >
            <LoginModal />
          </div>
        </div>
      </div>
    </main>
  );
};
