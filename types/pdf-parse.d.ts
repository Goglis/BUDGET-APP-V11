declare module "pdf-parse" {
  function pdfParse(
    dataBuffer: Buffer,
    options?: Record<string, unknown>
  ): Promise<{ numpages: number; text: string }>;
  export default pdfParse;
}
