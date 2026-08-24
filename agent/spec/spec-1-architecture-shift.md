### Architecture Shift

## overview

Our application is a AI Assistant that can listen to audio, input text and give you AI powered results

## description

Earlier the architceure of the application is

`Desktop (request) -> backend server (middle ware) -> llm provider (get response from)`

but from above to I wanna make it standalone Desktop application talking directly with the LLM provider with NO Middlewar eor backend.

`Desktop (request) ->  llm provider (get response from)`

## tasks

- Remove the external server dependency
- create new modal providers like gemini, openai, claude
- raw request are accepted and cleaned before rendeing into tyeh ui
- markdown response so easy ui rendering
- also we have text and audio features for audio we use model specific STT service
