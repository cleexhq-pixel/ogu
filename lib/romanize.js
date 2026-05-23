import { convert } from 'hangul-romanization';

/**
 * 한국어 텍스트를 로마자로 변환합니다.
 * 한국어가 아닌 문자(영어, 숫자, 특수문자)는 그대로 유지합니다.
 * 변환 실패 시 빈 문자열을 반환합니다.
 */
export function toRoman(text) {
  if (!text || typeof text !== 'string') return '';
  try {
    return convert(text);
  } catch {
    return '';
  }
}
