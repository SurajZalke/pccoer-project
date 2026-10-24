import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import BackgroundContainer from '@/components/BackgroundContainer';
import Logo from '@/components/Logo';
import OrbitBackground from '@/components/ui/OrbitBackground';

const sections = [
  {
    title: '1. Introduction',
    body: (
      <>
        Welcome to MSP College Advance. We are committed to protecting your privacy and handling your data in an
        open and transparent manner. This Privacy Policy explains how we collect, use, disclose, and safeguard
        your information when you visit our website{' '}
        <Link to="/" className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2">
          mspcollage.com
        </Link>
        , including any other media form, media channel, mobile website, or mobile application related or
        connected thereto (collectively, the "Site"). Please read this privacy policy carefully. If you do not
        agree with the terms of this privacy policy, please do not access the Site.
      </>
    ),
  },
  {
    title: '2. Information We Collect',
    body: (
      <>
        <p className="mb-4">
          We may collect information about you in a variety of ways. The information we may collect on the Site
          includes:
        </p>
        <h3 className="text-base font-semibold text-white mb-2 font-display">Personal Data</h3>
        <p className="mb-4">
          Personally identifiable information, such as your name, shipping address, email address, and telephone
          number, and demographic information, such as your age, gender, hometown, and interests, that you
          voluntarily give to us when you register with the Site or when you choose to participate in various
          activities related to the Site, such as online chat and message boards.
        </p>
        <h3 className="text-base font-semibold text-white mb-2 font-display">Derivative Data</h3>
        <p>
          Information our servers automatically collect when you access the Site, such as your IP address, your
          browser type, your operating system, your access times, and the pages you have viewed directly before
          and after accessing the Site.
        </p>
      </>
    ),
  },
  {
    title: '3. How We Use Your Information',
    body: (
      <>
        <p className="mb-4">
          Having accurate information about you permits us to provide you with a smooth, efficient, and
          customized experience. Specifically, we may use information collected about you via the Site to:
        </p>
        <ul className="list-none space-y-2">
          {[
            'Create and manage your account.',
            'Email you regarding your account or order.',
            'Enable user-to-user communications.',
            'Generate a personal profile about you to make your visit to the Site more personalized.',
            'Increase the efficiency and operation of the Site.',
            'Monitor and analyze usage and trends to improve your experience with the Site.',
            'Notify you of updates to the Site.',
            'Perform other business activities as needed.',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </>
    ),
  },
  {
    title: '4. Disclosure of Your Information',
    body: (
      <>
        <p className="mb-4">
          We may share information we have collected about you in certain situations. Your information may be
          disclosed as follows:
        </p>
        <h3 className="text-base font-semibold text-white mb-2 font-display">By Law or to Protect Rights</h3>
        <p className="mb-4">
          If we believe the release of information about you is necessary to respond to legal process, to
          investigate or remedy potential violations of our policies, or to protect the rights, property, or
          safety of others, we may share your information as permitted or required by any applicable law, rule,
          or regulation.
        </p>
        <h3 className="text-base font-semibold text-white mb-2 font-display">Third-Party Service Providers</h3>
        <p>
          We may share your information with third parties that perform services for us or on our behalf,
          including data analysis, email delivery, hosting services, customer service, and marketing assistance.
        </p>
      </>
    ),
  },
  {
    title: '5. Security of Your Information',
    body: (
      <>
        We use administrative, technical, and physical security measures to help protect your personal
        information. While we have taken reasonable steps to secure the personal information you provide to us,
        please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method
        of data transmission can be guaranteed against any interception or other type of misuse.
      </>
    ),
  },
  {
    title: '6. Contact Us',
    body: (
      <>
        If you have questions or comments about this Privacy Policy, please contact us at:{' '}
        <a href="mailto:support@mspcollage.com" className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2">
          support@mspcollage.com
        </a>
        .
      </>
    ),
  },
];

const PrivacyPolicyPage: React.FC = () => {
  return (
    <BackgroundContainer className="min-h-screen flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Helmet>
        <title>Privacy Policy - MSP College Advance</title>
        <meta name="description" content="Privacy Policy for MSP College Advance, outlining data collection, usage, and protection." />
      </Helmet>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-4xl w-full relative overflow-hidden lab-panel lab-panel-glow p-8 md:p-12 lg:p-16 z-10"
      >
        <OrbitBackground />
        <div className="relative z-10">
          <div className="flex flex-col items-center mb-8">
            <Logo />
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-3 py-1 mt-5 mb-3 font-display">
              <ShieldCheck className="h-3 w-3" /> Legal
            </span>
            <h1 className="lab-heading text-3xl md:text-4xl text-center">Privacy Policy</h1>
          </div>

          {sections.map((s, i) => (
            <motion.section
              key={s.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, delay: i * 0.03 }}
              className="mb-7 pb-7 border-b border-white/5 last:border-b-0 last:mb-0 last:pb-0"
            >
              <h2 className="text-lg font-bold text-white mb-3 font-display">{s.title}</h2>
              <div className="text-gray-400 leading-relaxed text-sm">{s.body}</div>
            </motion.section>
          ))}

          <div className="text-center mt-10">
            <Link
              to="/"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:opacity-90 text-white font-semibold font-display py-3 px-6 rounded-full transition-opacity shadow-lg shadow-indigo-500/25"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Home
            </Link>
          </div>
        </div>
      </motion.div>
    </BackgroundContainer>
  );
};

export default PrivacyPolicyPage;
