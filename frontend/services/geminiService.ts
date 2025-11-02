import { GoogleGenAI, Modality } from "@google/genai";
import { Client, Deal, Policy, Payment, FinancialTransaction, DealStatus, PolicyType, PaymentStatus, FinancialTransactionType } from '../types';

// --- Audio Decoding Utilities ---

/**
 * Decodes a base64 string into a Uint8Array.
 */
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodes raw PCM audio data into an AudioBuffer.
 */
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


// --- Gemini API Service ---

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
  sampleRate: 24000,
});

export const generateAndPlayAudio = async (text: string): Promise<void> => {
  if (!text.trim()) return;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (base64Audio) {
      const audioBytes = decode(base64Audio);
      const audioBuffer = await decodeAudioData(
        audioBytes,
        audioContext,
        24000,
        1,
      );

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();
    } else {
      throw new Error("No audio data received from API.");
    }
  } catch (error) {
    console.error("Error generating or playing audio:", error);
    throw error;
  }
};

// Fix: Added mock data generation function.
export const generateMockData = () => {
    const clients: Client[] = [
        { id: 'c1', name: "ООО 'ТехноСтрой'", email: 'contact@technostroy.com', phone: '+7 (495) 123-45-67', address: 'г. Москва, ул. Строителей, 15', notes: 'Крупный клиент, важен высокий уровень сервиса.' },
        { id: 'c2', name: 'Иванов Петр Сергеевич', email: 'ivanov.ps@email.com', phone: '+7 (916) 765-43-21', address: 'г. Москва, ул. Ленина, 10, кв. 5', birthDate: '1985-07-20' },
        { id: 'c3', name: "ИП 'Сидорова Анна'", email: 'sidorova.anna@biz.net', phone: '+7 (926) 987-65-43', address: 'г. Москва, пр. Мира, 120' },
    ];

    const deals: Deal[] = [
        {
            id: 'd1', title: 'Страхование автопарка (20 машин)', clientId: 'c1', status: 'Переговоры', owner: 'Продавец 1', assistant: 'Ассистент 1', summary: 'Продление годового контракта на страхование автопарка компании. Обсуждаются условия по КАСКО и ОСАГО. Клиент просит скидку 10%.', nextReviewDate: '2024-08-15',
            tasks: [{ id: 't1', description: 'Подготовить финальное коммерческое предложение', completed: false, assignee: 'Продавец 1', dueDate: '2024-08-10' }],
            notes: [{ id: 'n1', content: 'Клиент недоволен прошлогодним урегулированием убытка по машине A123BC77. Нужно сделать акцент на улучшении сервиса.', createdAt: '2024-08-01', status: 'active' }],
            quotes: [{ id: 'q1', insurer: 'Ингосстрах', insuranceType: 'КАСКО', sumInsured: 25000000, premium: 1200000, deductible: '50 000 руб. по каждой машине', comments: 'Базовое предложение' }],
            files: [{ id: 'f1', name: 'Список_ТС.xlsx', size: 15360, url: '#' }],
            chat: [{ id: 'ch1', sender: 'Клиент', text: 'Добрый день! Ждем от вас обновленное предложение. Хотелось бы видеть более гибкие условия.', timestamp: '2024-08-02T10:30:00Z' }],
            activityLog: [{ id: 'al1', timestamp: '2024-08-01T14:00:00Z', user: 'Продавец 1', action: 'Создана сделка' }],
        },
        {
            id: 'd2', title: 'Ипотечное страхование квартиры', clientId: 'c2', status: 'Оформление', owner: 'Продавец 2', summary: 'Клиент покупает квартиру в ипотеку от Сбербанка. Требуется страхование жизни, здоровья и имущества. Документы на финальной проверке.', nextReviewDate: '2024-08-05',
            tasks: [{ id: 't2', description: 'Получить от клиента скан кредитного договора', completed: true, assignee: 'Ассистент 2', dueDate: '2024-08-01' }],
            notes: [], quotes: [], files: [], chat: [], activityLog: []
        },
        {
            id: 'd3', title: 'КАСКО на новый автомобиль', clientId: 'c2', status: 'Новая', owner: 'Продавец 1', summary: 'Клиент приобрел новый автомобиль (BMW X5). Требуется расчет КАСКО с максимальным покрытием.', nextReviewDate: '2024-09-01',
            tasks: [], notes: [], quotes: [], files: [], chat: [], activityLog: []
        },
    ];

    const policies: Policy[] = [
        { id: 'p1', policyNumber: 'XXX-12345678', type: 'Имущество', startDate: '2023-09-01', endDate: '2024-08-31', counterparty: 'РЕСО-Гарантия', salesChannel: 'Прямые продажи', clientId: 'c3', dealId: 'd-past-1' },
    ];
    
    const payments: Payment[] = [
        { id: 'pay1', policyId: 'p1', clientId: 'c3', amount: 25000, dueDate: '2024-08-15', status: 'Ожидает' },
    ];
    
    const financialTransactions: FinancialTransaction[] = [
        { id: 'fin1', description: 'Комиссия от РЕСО по полису XXX-12345678', amount: 5000, type: 'Доход', date: '2024-08-20', policyId: 'p1', dealId: 'd-past-1' },
    ];

    return { clients, deals, policies, payments, financialTransactions };
};
