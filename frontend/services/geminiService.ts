import { GoogleGenAI, Modality } from "@google/genai";
import { Client, Deal, Policy, Payment, FinancialTransaction } from '../types';

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

// Lazy init: only create when API key is available
let ai: any = null;
let audioContext: AudioContext | null = null;

const initializeGemini = () => {
  if (ai) return ai;

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    console.warn('[TTS] No GEMINI_API_KEY found, TTS will use fallback (Web Speech API)');
    return null;
  }

  try {
    ai = new GoogleGenAI({ apiKey });
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 24000,
    });
    return ai;
  } catch (error) {
    console.warn('[TTS] Failed to initialize GoogleGenAI:', error);
    return null;
  }
};

/**
 * Fallback TTS using Web Speech API (browser native)
 */
const fallbackTTS = async (text: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ru-RU';
    utterance.onend = () => resolve();
    utterance.onerror = (event) => reject(new Error(`Speech synthesis error: ${event.error}`));
    window.speechSynthesis.speak(utterance);
  });
};

export const generateAndPlayAudio = async (text: string): Promise<void> => {
  if (!text.trim()) return;

  const client = initializeGemini();

  // Fallback: use Web Speech API if Gemini not available
  if (!client || !audioContext) {
    console.log('[TTS] Using Web Speech API fallback');
    return fallbackTTS(text);
  }

  try {
    const response = await client.models.generateContent({
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

    if (base64Audio && audioContext) {
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
    console.error("Error generating or playing audio via Gemini:", error);
    // Fallback to Web Speech API on error
    console.log('[TTS] Falling back to Web Speech API after Gemini error');
    return fallbackTTS(text);
  }
};

// Fix: Added mock data generation function.
export const generateMockData = () => {
  const clients: Client[] = [
    {
      id: "c1",
      name: "ООО «ТехноСтрой»",
      email: "contact@technostroy.com",
      phone: "+7 (495) 123-45-67",
      address: "г. Москва, ул. Строителей, 15",
      notes: "Крупный корпоративный клиент, ожидает персонального сопровождения.",
      status: "active",
      ownerId: "u1",
      createdAt: "2023-11-05T09:15:00.000Z",
      updatedAt: "2024-07-25T12:10:00.000Z",
      isDeleted: false,
    },
    {
      id: "c2",
      name: "Иванов Петр Сергеевич",
      email: "ivanov.ps@email.com",
      phone: "+7 (916) 765-43-21",
      address: "г. Москва, ул. Ленина, 10, кв. 5",
      birthDate: "1985-07-20",
      status: "active",
      ownerId: "u2",
      createdAt: "2024-02-18T11:30:00.000Z",
      updatedAt: "2024-07-28T08:40:00.000Z",
      isDeleted: false,
    },
    {
      id: "c3",
      name: "ИП «Сидорова Анна»",
      email: "sidorova.anna@biz.net",
      phone: "+7 (926) 987-65-43",
      address: "г. Москва, пр. Мира, 120",
      status: "prospect",
      ownerId: "u3",
      createdAt: "2024-03-05T10:05:00.000Z",
      updatedAt: "2024-07-12T15:25:00.000Z",
      isDeleted: false,
    },
  ];

  const deals: Deal[] = [
    {
      id: "d1",
      title: "Страхование автопарка (20 машин)",
      clientId: "c1",
      ownerId: "u1",
      owner: "Мария Иванова",
      assistant: "Ассистент 1",
      status: "negotiation",
      stage: "proposal",
      nextReviewAt: "2024-08-15T00:00:00.000Z",
      nextReviewDate: "2024-08-15",
      createdAt: "2023-12-20T13:45:00.000Z",
      updatedAt: "2024-07-26T16:05:00.000Z",
      isDeleted: false,
      summary:
        "Продление годового контракта на страхование автопарка компании. Клиент ожидает скидку и улучшенный сервис урегулирования.",
      tasks: [
        {
          id: "t1",
          title: "Подготовить финальное коммерческое предложение",
          description: "Актуализировать тарифы и учесть пожелания клиента по франшизе.",
          dealId: "d1",
          clientId: "c1",
          status: "in_progress",
          assignee: "Ассистент 1",
          dueDate: "2024-08-10",
          createdAt: "2024-07-20T08:00:00.000Z",
          updatedAt: "2024-07-24T09:30:00.000Z",
        },
      ],
      notes: [
        {
          id: "n1",
          content:
            "Клиент недоволен прошлогодним урегулированием убытка по машине A123BC77. Важно подчеркнуть изменения в SLA.",
          dealId: "d1",
          createdAt: "2024-07-01T09:10:00.000Z",
          updatedAt: "2024-07-22T14:45:00.000Z",
          status: "active",
        },
      ],
      quotes: [
        {
          id: "q1",
          dealId: "d1",
          insurer: "Ингосстрах",
          insuranceType: "Auto",
          sumInsured: 25000000,
          premium: 1200000,
          deductible: "50 000 ₽ по каждому событию",
          comments: "Базовое предложение",
          createdAt: "2024-07-18T10:20:00.000Z",
          updatedAt: "2024-07-25T11:15:00.000Z",
          isDeleted: false,
        },
      ],
      files: [
        {
          id: "f1",
          name: "spisok_ts.xlsx",
          size: 15360,
          url: "#",
          createdAt: "2024-07-19T07:55:00.000Z",
        },
      ],
      chat: [
        {
          id: "ch1",
          dealId: "d1",
          sender: "client",
          senderName: "Алексей Петров",
          text: "Добрый день! Ждем обновленное предложение и финальные условия по франшизе.",
          timestamp: "2024-07-23T10:30:00.000Z",
        },
      ],
      activityLog: [
        {
          id: "al1",
          dealId: "d1",
          timestamp: "2023-12-20T13:45:00.000Z",
          userId: "u1",
          user: "Мария Иванова",
          action: "created",
          description: "Создана сделка и назначен ответственный менеджер.",
        },
        {
          id: "al2",
          dealId: "d1",
          timestamp: "2024-07-24T09:35:00.000Z",
          userId: "u4",
          user: "Ассистент 1",
          action: "note_added",
          description: "Добавлен комментарий по ожиданиям клиента.",
        },
      ],
    },
    {
      id: "d2",
      title: "Ипотечное страхование квартиры",
      clientId: "c2",
      ownerId: "u2",
      owner: "Сергей Козлов",
      status: "contract",
      stage: "closing",
      nextReviewAt: "2024-08-05T00:00:00.000Z",
      createdAt: "2024-05-11T10:00:00.000Z",
      updatedAt: "2024-07-29T12:00:00.000Z",
      isDeleted: false,
      summary:
        "Клиент оформляет ипотеку в Сбербанке, требуется пакет страхования жизни и имущества.",
      tasks: [
        {
          id: "t2",
          title: "Получить скан кредитного договора",
          description: "Уточнить корректность паспортных данных и сумму кредита.",
          dealId: "d2",
          clientId: "c2",
          status: "completed",
          assignee: "Ассистент 2",
          dueDate: "2024-08-01",
          completed: true,
          createdAt: "2024-07-10T14:10:00.000Z",
          updatedAt: "2024-07-31T09:15:00.000Z",
        },
      ],
      notes: [],
      quotes: [],
      files: [],
      chat: [],
      activityLog: [
        {
          id: "al3",
          dealId: "d2",
          timestamp: "2024-07-29T12:00:00.000Z",
          userId: "u2",
          user: "Сергей Козлов",
          action: "documents_verified",
          description: "Пакет документов отправлен в страховую компанию.",
        },
      ],
    },
    {
      id: "d3",
      title: "КАСКО на новый автомобиль",
      clientId: "c2",
      ownerId: "u1",
      owner: "Мария Иванова",
      status: "Новая",
      stage: "qualification",
      nextReviewAt: "2024-09-01T00:00:00.000Z",
      createdAt: "2024-07-15T08:20:00.000Z",
      updatedAt: "2024-07-30T17:45:00.000Z",
      isDeleted: false,
      summary: "Клиент приобрел новый BMW X5 и запрашивает полный пакет КАСКО.",
      tasks: [],
      notes: [],
      quotes: [],
      files: [],
      chat: [],
      activityLog: [
        {
          id: "al4",
          dealId: "d3",
          timestamp: "2024-07-30T17:45:00.000Z",
          userId: "u1",
          user: "Мария Иванова",
          action: "contact_made",
          description: "Созвон с клиентом, уточнены параметры автомобиля.",
        },
      ],
    },
  ];

  const policies: Policy[] = [
    {
      id: "p1",
      policyNumber: "XXX-12345678",
      type: "Property",
      clientId: "c1",
      dealId: "d1",
      ownerId: "u1",
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      counterparty: "РЕСО-Гарантия",
      salesChannel: "Прямые продажи",
      notes: "Полис покрывает склады и основное оборудование.",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-06-30T10:00:00.000Z",
      isDeleted: false,
    },
    {
      id: "p2",
      policyNumber: "AUTO-90807060",
      type: "Auto",
      clientId: "c2",
      dealId: "d2",
      ownerId: "u2",
      startDate: "2024-07-01",
      endDate: "2025-06-30",
      counterparty: "АльфаСтрахование",
      salesChannel: "Партнерское агентство",
      createdAt: "2024-07-01T09:00:00.000Z",
      updatedAt: "2024-07-28T12:30:00.000Z",
      isDeleted: false,
    },
  ];

  const payments: Payment[] = [
    {
      id: "pay1",
      policyId: "p1",
      dealId: "d1",
      clientId: "c1",
      amount: 250000,
      status: "paid",
      dueDate: "2024-02-01",
      paidDate: "2024-01-28",
      createdAt: "2024-01-05T10:00:00.000Z",
      updatedAt: "2024-01-28T15:45:00.000Z",
      isDeleted: false,
    },
    {
      id: "pay2",
      policyId: "p2",
      dealId: "d2",
      clientId: "c2",
      amount: 48000,
      status: "pending",
      dueDate: "2024-08-10",
      createdAt: "2024-07-05T11:20:00.000Z",
      updatedAt: "2024-07-29T12:00:00.000Z",
      isDeleted: false,
    },
  ];

  const financialTransactions: FinancialTransaction[] = [
    {
      id: "fin1",
      description: "Комиссия брокера за продление полиса XXX-12345678",
      amount: 50000,
      type: "income",
      date: "2024-01-30",
      paymentDate: "2024-01-30",
      dealId: "d1",
      policyId: "p1",
      createdAt: "2024-01-30T12:15:00.000Z",
      updatedAt: "2024-01-30T12:15:00.000Z",
    },
    {
      id: "fin2",
      description: "Расход на маркетинг для привлечения клиента ИП «Сидорова Анна»",
      amount: 12000,
      type: "expense",
      date: "2024-06-15",
      dealId: "d3",
      createdAt: "2024-06-15T09:00:00.000Z",
      updatedAt: "2024-06-20T10:30:00.000Z",
    },
  ];

  return { clients, deals, policies, payments, financialTransactions };
};
