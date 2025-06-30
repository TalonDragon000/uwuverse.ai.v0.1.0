import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, ExternalLink, ArrowLeft, BookOpen } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import NewsletterSignup from '../components/marketing/NewsletterSignup';
import { motion } from 'framer-motion';

const BlogPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow pt-20 pb-10">
        {/* Hero Section */}
        <section className="py-16 px-4 bg-gradient-to-b from-pink-100/50 to-transparent dark:from-pink-900/30">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-pink-400 to-purple-500 bg-clip-text text-transparent">
                UwUverse Blog
              </h1>
              <p className="text-xl md:text-2xl mb-8 text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                Insights, updates, and stories from the world of AI companionship. 
                Stay updated with the latest features, tips, and community highlights.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <a
                  href="https://uwuverse.beehiiv.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-pink-400 to-purple-500 hover:from-pink-500 hover:to-purple-600 text-white rounded-full font-medium transition-all duration-200 transform hover:scale-105"
                >
                  <ExternalLink className="h-5 w-5 mr-2" />
                  Visit Newsletter Homepage
                </a>
                <a
                  href="https://uwuverse.beehiiv.com/subscribe"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-6 py-3 border-2 border-pink-400 text-pink-600 dark:text-pink-400 hover:bg-pink-400 hover:text-white rounded-full font-medium transition-all duration-200"
                >
                  Subscribe to Newsletter
                </a>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Coming Soon Section */}
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 md:p-12"
            >
              <div className="flex flex-col items-center">
                <BookOpen className="h-16 w-16 text-pink-400 mb-6" />
                <h2 className="text-3xl font-bold mb-4">Blog Posts Coming Soon!</h2>
                <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl">
                  We're working on bringing you amazing content about AI companionship, 
                  relationship tips, and platform updates. Stay tuned!
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 w-full max-w-3xl">
                  <div className="text-center p-4 bg-pink-50 dark:bg-pink-900/20 rounded-xl">
                    <Calendar className="h-8 w-8 text-pink-500 mx-auto mb-2" />
                    <h3 className="font-semibold mb-1">Weekly Updates</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Platform news and feature announcements
                    </p>
                  </div>
                  
                  <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                    <Clock className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                    <h3 className="font-semibold mb-1">AI Insights</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Deep dives into AI companion technology
                    </p>
                  </div>
                  
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <ExternalLink className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                    <h3 className="font-semibold mb-1">Community Stories</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      User experiences and success stories
                    </p>
                  </div>
                </div>

                <Link
                  to="/"
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-pink-400 to-purple-500 hover:from-pink-500 hover:to-purple-600 text-white rounded-full font-medium transition-all duration-200"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Home
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Newsletter Signup Section */}
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <NewsletterSignup />
          </div>
        </section>
      </main>
    </div>
  );
};

export default BlogPage;