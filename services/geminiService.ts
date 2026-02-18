import { GoogleGenAI } from "@google/genai";

/**
 * 학생의 활동 기록을 학교생활기록부 기재 형식에 맞게 변환합니다.
 */
export const polishRecord = async (
  rawText: string,
  onStatusUpdate?: (status: string) => void
): Promise<string> => {
  // 가이드라인: process.env.API_KEY를 직접 사용하여 인스턴스 생성
  const apiKey = process.env.API_KEY;

  if (!apiKey || apiKey.length < 5) {
    throw new Error("Vercel 환경 변수에 API_KEY가 설정되어 있지 않습니다. 설정을 확인해 주세요.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  if (onStatusUpdate) {
    onStatusUpdate("AI 분석 중...");
  }

  const systemInstruction = `당신은 대한민국 고등학교의 베테랑 교사입니다. 
다음 원칙에 따라 학생의 활동 관찰 기록을 생활기록부용 문장으로 변환하세요:
1. 전문적인 교육 용어를 사용하며, 문장은 반드시 '~함', '~임'으로 끝나는 명사형 종결 어미를 사용하십시오.
2. 학생의 구체적인 행동과 그로 인한 변화나 성장을 중점적으로 서술하십시오.
3. 결과물만 출력하고 인사말이나 부연 설명은 절대 하지 마십시오.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `다음 내용을 생기부 문체로 변환해줘: ${rawText.trim()}`,
      config: {
        systemInstruction,
        temperature: 0.4,
        topP: 0.8,
        maxOutputTokens: 1000,
      },
    });

    const result = response.text;
    if (!result) throw new Error("AI 응답이 비어있습니다.");
    
    return result.trim();

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error.message?.includes("API key")) {
      throw new Error("유효하지 않은 API Key입니다. 설정을 다시 확인해 주세요.");
    }
    throw new Error(error.message || "AI 변환 중 오류가 발생했습니다.");
  }
};