import React from "react";
import { SystemAudioRecorder } from "../components/SystemAudioRecorder";

export const AudioRecordingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">System Audio Recording</h1>
          <p className="text-gray-600 leading-relaxed">
            Record system audio directly from your Windows computer. This feature captures audio
            that is playing through your default output device (speakers/headphones), perfect for
            recording meetings, presentations, or any audio content.
          </p>
        </div>

        <div className="grid gap-6">
          {/* Main Recording Interface */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <SystemAudioRecorder className="w-full" />
          </div>

          {/* Information Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Requirements Card */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-4">Requirements</h3>
              <ul className="space-y-2 text-blue-800 text-sm">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  Windows operating system
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  Active audio output device
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  FFmpeg executable in resources
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  Sufficient disk space
                </li>
              </ul>
            </div>

            {/* Technical Details Card */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-green-900 mb-4">Technical Details</h3>
              <ul className="space-y-2 text-green-800 text-sm">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Uses WASAPI loopback capture
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  WAV format (uncompressed)
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  44.1kHz or 48kHz sample rate
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Stereo (2 channel) output
                </li>
              </ul>
            </div>
          </div>

          {/* Troubleshooting Card */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-yellow-900 mb-4">Troubleshooting</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-yellow-900 mb-2">Common Issues:</h4>
                <ul className="space-y-1 text-yellow-800 text-sm">
                  <li>• No audio devices detected</li>
                  <li>• Recording produces silence</li>
                  <li>• FFmpeg not found error</li>
                  <li>• Permission denied errors</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-yellow-900 mb-2">Solutions:</h4>
                <ul className="space-y-1 text-yellow-800 text-sm">
                  <li>• Check Windows Sound settings</li>
                  <li>• Close other audio applications</li>
                  <li>• Run as Administrator</li>
                  <li>• Update audio drivers</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>
            Recordings are saved to your Downloads folder by default. Files are in WAV format for
            maximum compatibility.
          </p>
        </div>
      </div>
    </div>
  );
};
