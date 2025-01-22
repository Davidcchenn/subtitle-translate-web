import dotenv from 'dotenv';
import axios from 'axios/dist/node/axios.cjs';

dotenv.config();
const axiosInstance = axios.create({
    timeout: 10000 
});

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Only POST requests allowed' });
        return;
    }

    try {
        const { inputContent, apiKey, customPrompt } = req.body;
        let promt = '';
        const basePrompt = "Translate the subtitles in this file into Vietnamese with the following requirements: \n" +
                    "Maintain the original format, including sequence numbers, timestamps, and the number of lines.\n" +
                    "Preserve the capitalization exactly as in the original text for languages that distinguish between uppercase and lowercase letters (e.g., English).\n" +
                    "For languages that do not distinguish between uppercase and lowercase letters (e.g., Chinese):\n" +
                    "Detect proper nouns (e.g., names of people, places, or organizations) and convert them to standard pinyin. Ensure the first letter of each word in pinyin is capitalized.\n" +
                    "Use standard pinyin rules: No diacritics (e.g., \"Song Chengli\" instead of \"sòng chénglǐ\").\n" +
                    "Retain other parts of the sentence in lowercase and capitalize only the first letter of the sentence.\n" +
                    "Keep the original Chinese characters when applicable, without any modification." +
                    "Do not merge content from different timestamps into a single translation block.\n" +
                    "Retain all punctuation, special characters, and line breaks from the original content to preserve the original flow and structure of the subtitles.\n" +
                    "Return only the translated content in the specified format, without any additional explanations, introductions, or questions.\n";
        if(!customPrompt) {
            promt = basePrompt +
                "Ensure translations are accurate and match the context, culture, and situations in the movie. Use natural and conversational Vietnamese that reflects the tone and emotion of the original dialogue.\n" +
                "Avoid literal translations that sound unnatural in Vietnamese. Adjust word choices and sentence structures to make the translation feel fluent and emotionally aligned with the movie's tone.\n";
        } else {
            promt = basePrompt + customPrompt;
        }

        promt += inputContent;

        if (!inputContent) {
            res.status(400).json({ error: 'Input content is required' });
            return;
        }

        const translatedPart = await translateText(promt, apiKey);
        res.status(200).json({ translatedContent: translatedPart });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
}


function splitSRTContent(srtContent, charLimit) {
    const lines = srtContent.split('\n');
    const parts = [];
    let currentPart = '';

    for (const line of lines) {
        if ((currentPart.length + line.length + 1 > charLimit) && line.trim() === '') {
            parts.push(currentPart.trim());
            currentPart = '';
        }
        currentPart += line + '\n';
    }
    if (currentPart) parts.push(currentPart.trim());
    return parts;
}

async function translateText(text, apiKey) {
    const response = await axiosInstance.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
        {
            contents: [
                {
                    role: 'user',
                    parts: [{ text }]
                }
            ],
            generationConfig: {
                temperature: 0.7,
                topK: 50,
                topP: 0.9,
                maxOutputTokens: 8192,
                responseMimeType: 'text/plain'
            }
        },
        {
            headers: { 'Content-Type': 'application/json' }
        }
    );

    const candidates = response.data.candidates;
    if (candidates && candidates.length > 0) {
        return candidates[0].content.parts[0].text;
    }
    throw new Error('Translation failed');
}
