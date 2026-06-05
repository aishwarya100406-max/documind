// Multi-page PDF with formulas, to test page-aware ingestion + page-wise summary.
import PDFDocument from 'pdfkit';
import fs from 'fs';

const out = process.argv[2] || 'formulas.pdf';
const doc = new PDFDocument({ margin: 50 });
doc.pipe(fs.createWriteStream(out));

function page(title, lines) {
  doc.fontSize(18).text(title, { underline: true });
  doc.moveDown();
  doc.fontSize(12).text(lines.join('\n'));
}

page('Page 1 - Kinematics', [
  'This document collects core physics and mathematics formulas.',
  '',
  'Newtons second law: F = m * a, where F is force, m is mass, a is acceleration.',
  'Velocity: v = u + a * t.',
  'Displacement: s = u * t + 0.5 * a * t^2.',
]);

doc.addPage();
page('Page 2 - Energy and Waves', [
  'Mass-energy equivalence: E = m * c^2.',
  'Kinetic energy: KE = 0.5 * m * v^2.',
  'Wave speed: v = f * lambda, where f is frequency and lambda is wavelength.',
  'Ohms law: V = I * R.',
]);

doc.addPage();
page('Page 3 - Mathematics', [
  'Quadratic formula: x = (-b +/- sqrt(b^2 - 4*a*c)) / (2*a).',
  'Area of a circle: A = pi * r^2.',
  'Pythagorean theorem: a^2 + b^2 = c^2.',
  'Compound interest: A = P * (1 + r/n)^(n*t).',
]);

doc.end();
console.log('wrote', out);
