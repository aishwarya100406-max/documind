// Generates a valid sample PDF (via pdfkit) to exercise the ingestion pipeline.
import PDFDocument from 'pdfkit';
import fs from 'fs';

const out = process.argv[2] || 'sample.pdf';
const doc = new PDFDocument();
doc.pipe(fs.createWriteStream(out));

doc.fontSize(18).text('DocuMind Test Document', { underline: true });
doc.moveDown();
doc.fontSize(12).text(
  [
    'DocuMind is a retrieval augmented generation application. It parses PDF files, splits ' +
      'the text into overlapping chunks, and stores vector embeddings inside a ChromaDB collection.',
    '',
    'The capital of France is Paris. The Eiffel Tower is located in Paris and was completed in 1889. ' +
      'Water boils at 100 degrees Celsius at sea level.',
    '',
    'When a user asks a question, DocuMind embeds the question, retrieves the five most similar ' +
      'chunks using cosine similarity, and asks the Groq llama3-8b-8192 model to answer using only ' +
      'that context. If no relevant chunk is found, it refuses to answer instead of guessing.',
  ].join('\n')
);

doc.end();
console.log('wrote', out);
