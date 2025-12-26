import { Link } from 'react-router-dom';
import { Code2, Users, Zap } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-black text-white">
      {}
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          {}
          <h1 className="text-7xl font-bold mb-6 bg-gradient-to-r from-yellow-400 via-red-500 to-yellow-600 bg-clip-text text-transparent">
            CodeCollab
          </h1>
          
          <p className="text-2xl text-gray-300 mb-4">
            Real-time collaborative code editing
          </p>
          <p className="text-lg text-gray-400 mb-12">
            Code together, build together. Share your workspace and collaborate in real-time.
          </p>

          {}
          <div className="flex gap-4 justify-center mb-20">
            <Link
              to="/signup"
              className="px-8 py-4 bg-gradient-to-r from-yellow-500 via-red-500 to-yellow-600 text-black font-bold rounded-lg hover:from-yellow-400 hover:via-red-400 hover:to-yellow-500 transition-all duration-200 shadow-lg shadow-yellow-500/50"
            >
              Get Started
            </Link>
            <Link
              to="/login"
              className="px-8 py-4 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-700 transition-all duration-200 border border-gray-700"
            >
              Login
            </Link>
          </div>

          {}
          <div className="bg-gray-900 rounded-xl p-8 border border-gray-800 mb-16">
            <div className="bg-black rounded-lg p-6 font-mono text-sm text-left">
              <div className="flex gap-2 mb-4">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <div className="text-gray-400">
                <span className="text-purple-400">def</span>{' '}
                <span className="text-yellow-400">hello_world</span>():<br />
                {'    '}
                <span className="text-green-400">print</span>(
                <span className="text-orange-400">"Hello, CodeCollab!"</span>)
              </div>
            </div>
          </div>

          {}
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
              <Code2 className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Real-time Editing</h3>
              <p className="text-gray-400">
                See changes as they happen. Multiple users can code together seamlessly.
              </p>
            </div>
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
              <Users className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Collaborative</h3>
              <p className="text-gray-400">
                Share your projects with a link. Work together in real-time.
              </p>
            </div>
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
              <Zap className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Fast & Powerful</h3>
              <p className="text-gray-400">
                Built for developers. Syntax highlighting, code execution, and more.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

