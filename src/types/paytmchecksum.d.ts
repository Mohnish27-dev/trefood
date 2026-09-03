declare module "paytmchecksum" {
  export default class PaytmChecksum {
    static generateSignature(
      params: string | Record<string, unknown>,
      key: string,
    ): Promise<string>;
    static verifySignature(
      params: string | Record<string, unknown>,
      key: string,
      checksum: string,
    ): Promise<boolean>;
    static generateSignatureByString(params: string, key: string): Promise<string>;
    static verifySignatureByString(params: string, key: string, checksum: string): boolean;
  }
}
