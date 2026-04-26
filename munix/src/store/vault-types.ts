/**
 * VaultId — backend가 부여하는 UUID v4 문자열. (ADR-031)
 *
 * 별도 alias 타입을 두어 일반 string 과 의미를 분리하고, 향후
 * branded type 으로 강화하기 쉽게 한다.
 */
export type VaultId = string;
