# Local subject cutout

The local cutout feature uses `@imgly/background-removal` 1.7.0 (IMG.LY),
licensed under AGPL-3.0. See the bundled package's LICENSE.md and
https://github.com/imgly/background-removal-js for the full license and source.
Review applicable distribution/source obligations or obtain appropriate commercial
licensing before public or closed-source distribution.

Inference uses ISNet FP16 in a browser worker via ONNX Runtime Web 1.21.0.
Model and runtime resources download from IMG.LY's default asset CDN on demand.
Photos are passed to the local worker, not uploaded to the CDN or an API.
Network access is still needed on first use; this is not a fully offline bundle.
The separate AI Remix feature continues to upload images to OpenAI when selected.
