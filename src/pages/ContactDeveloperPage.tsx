import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Mail, Phone, Loader } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getApiBaseUrl } from '@/lib/apiBase';

const ContactDeveloperPage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const apiUrl = getApiBaseUrl();

      const response = await fetch(`${apiUrl}/api/auth/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitted(true);
        toast({
          title: 'Message Sent!',
          description: 'Thank you for contacting us. We will get back to you soon.',
        });
        setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to send message',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Network error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-[#050816] py-12 px-4 relative overflow-hidden"
    >
      {/* Background decorative elements */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute top-1/3 -right-32 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-blob animation-delay-4000" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="lab-heading text-4xl md:text-5xl mb-4">Get in Touch</h1>
          <p className="text-gray-400 text-lg">Have questions or feedback? Let's connect!</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Contact Information</h2>
              <p className="text-purple-200 mb-8">
                Feel free to reach out for any inquiries, bug reports, or feature suggestions!
              </p>
            </div>

            {/* Email Card */}
            <Card className="border border-purple-300/20 bg-white/10 backdrop-blur-sm hover:bg-white/15 transition-all">
              <CardContent className="p-6 flex items-start gap-4">
                <div className="bg-purple-600/30 p-3 rounded-full flex-shrink-0">
                  <Mail className="w-6 h-6 text-purple-300" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-2">Email</h3>
                  <a href="mailto:surajzalke724@gmail.com" className="text-purple-200 hover:text-purple-100">
                    surajzalke724@gmail.com
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* Phone Card */}
            <Card className="border border-purple-300/20 bg-white/10 backdrop-blur-sm hover:bg-white/15 transition-all">
              <CardContent className="p-6 flex items-start gap-4">
                <div className="bg-purple-600/30 p-3 rounded-full flex-shrink-0">
                  <Phone className="w-6 h-6 text-purple-300" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-2">Quick Response</h3>
                  <p className="text-purple-200">
                    Use the form on the right for faster responses. We typically reply within 24 hours.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Developer Info */}
            <Card className="border border-green-300/20 bg-green-500/10 backdrop-blur-sm">
              <CardContent className="p-6">
                <h3 className="font-semibold text-green-200 mb-2">👨‍💻 Developer</h3>
                <p className="text-green-200/80 text-sm mb-2">
                  Suraj Zalke - Full Stack Developer & AI Enthusiast
                </p>
                <p className="text-green-200/70 text-xs">
                  Specializing in web development, AI integration, and cloud infrastructure.
                </p>
                <a
                  href="https://suraj-zalke-protfolio.netlify.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-3 text-green-300 hover:text-green-200 font-semibold text-sm"
                >
                  View Portfolio →
                </a>
              </CardContent>
            </Card>
          </motion.div>

          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            {submitted ? (
              <Card className="border border-green-300/20 bg-green-500/10 backdrop-blur-sm h-full flex items-center justify-center">
                <CardContent className="p-8 text-center">
                  <div className="text-6xl mb-4">✅</div>
                  <h3 className="text-2xl font-bold text-green-200 mb-2">Message Received!</h3>
                  <p className="text-green-200/80 mb-6">
                    Thank you for contacting us. We'll get back to you as soon as possible.
                  </p>
                  <Button
                    onClick={() => {
                      setSubmitted(false);
                      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
                    }}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Send Another Message
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="border border-purple-300/20 bg-white/10 backdrop-blur-sm">
                <CardHeader className="bg-gradient-to-r from-purple-600/50 to-indigo-600/50">
                  <CardTitle className="text-white">Send us a Message</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Name */}
                    <div>
                      <label className="text-sm font-medium text-purple-200 block mb-2">Name</label>
                      <Input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Your name"
                        required
                        disabled={loading}
                        className="bg-white/10 border border-purple-300/20 text-white placeholder:text-white/50"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label className="text-sm font-medium text-purple-200 block mb-2">Email</label>
                      <Input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="your@email.com"
                        required
                        disabled={loading}
                        className="bg-white/10 border border-purple-300/20 text-white placeholder:text-white/50"
                      />
                    </div>

                    {/* Phone (Optional) */}
                    <div>
                      <label className="text-sm font-medium text-purple-200 block mb-2">Phone (Optional)</label>
                      <Input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="Your phone number"
                        disabled={loading}
                        className="bg-white/10 border border-purple-300/20 text-white placeholder:text-white/50"
                      />
                    </div>

                    {/* Subject */}
                    <div>
                      <label className="text-sm font-medium text-purple-200 block mb-2">Subject</label>
                      <Input
                        type="text"
                        name="subject"
                        value={formData.subject}
                        onChange={handleChange}
                        placeholder="What is this about?"
                        required
                        disabled={loading}
                        className="bg-white/10 border border-purple-300/20 text-white placeholder:text-white/50"
                      />
                    </div>

                    {/* Message */}
                    <div>
                      <label className="text-sm font-medium text-purple-200 block mb-2">Message</label>
                      <textarea
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        placeholder="Your message here..."
                        required
                        disabled={loading}
                        rows={5}
                        className="w-full bg-white/10 border border-purple-300/20 text-white placeholder:text-white/50 rounded-lg p-3 focus:outline-none focus:border-purple-300/50"
                      />
                    </div>

                    {/* Submit Button */}
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold py-2 rounded-lg transition-all disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <Loader className="w-4 h-4 mr-2 animate-spin inline" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4 mr-2 inline" />
                          Send Message
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default ContactDeveloperPage;
