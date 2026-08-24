<!-- install packages -->

npm install @elevenlabs/elevenlabs-js
npm install dotenv

<!-- code reference -->

import { ElevenLabsClient, play } from '@elevenlabs/elevenlabs-js';
import { Readable } from 'stream';
import 'dotenv/config';

const elevenlabs = new ElevenLabsClient();
const transcription = await elevenlabs.speechToText.convert({
file: audioBlob,
modelId: "scribe_v2", // Model to use
tagAudioEvents: true, // Tag audio events like laughter, applause, etc.
languageCode: "eng", // Language of the audio file. If set to null, the model will detect the language automatically.
diarize: true, // Whether to annotate who is speaking
});
console.log(transcription);
4
