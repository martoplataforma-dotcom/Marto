declare module 'qrcode' {
  type QRCodeErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

  type QRCodeToDataURLOptions = {
    errorCorrectionLevel?: QRCodeErrorCorrectionLevel;
    margin?: number;
    scale?: number;
  };

  const QRCode: {
    toDataURL(
      text: string,
      options?: QRCodeToDataURLOptions,
    ): Promise<string>;
  };

  export default QRCode;
}
