import { VercelRequest, VercelResponse } from "@vercel/node";
import catalog from "./catalog.json";

interface Deal {
    id: number;
    name: string;
    category: string;
    location: string;
    deal: string;
    description: string;
}

interface WhatsAppMessage {
    from: string;
    id: string;
    timestamp: string;
    text: {
        body: string;
    };
    type: string;
}

interface WhatsAppWebhook {
    entry: Array<{
        changes: Array<{
            value: {
                messages?: WhatsAppMessage[];
                metadata: {
                    phone_number_id: string;
                };
            };
        }>;
    }>;
}

function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function calculateSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0) return len2;
    if (len2 === 0) return len1;

    const matrix = Array(len2 + 1)
        .fill(null)
        .map(() => Array(len1 + 1).fill(null));

    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;

    for (let j = 1; j <= len2; j++) {
        for (let i = 1; i <= len1; i++) {
            const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1,
                matrix[j - 1][i] + 1,
                matrix[j - 1][i - 1] + substitutionCost,
            );
        }
    }

    const maxLen = Math.max(len1, len2);
    return (maxLen - matrix[len2][len1]) / maxLen;
}

function extractSearchTerms(query: string): string[] {
    const normalized = normalizeText(query);
    const greetings = [
        "hi",
        "hello",
        "hey",
        "find",
        "search",
        "looking",
        "want",
        "need",
        "near",
        "me",
        "bot",
    ];
    const words = normalized
        .split(" ")
        .filter((word) => word.length > 2 && !greetings.includes(word));
    return words;
}

function findDeals(query: string): Deal[] {
    const searchTerms = extractSearchTerms(query);
    if (searchTerms.length === 0) {
        return [];
    }

    const dealScores = catalog.map((deal) => {
        let maxScore = 0;
        const dealText =
            `${deal.name} ${deal.category} ${deal.description}`.toLowerCase();

        searchTerms.forEach((term) => {
            const exactMatch = dealText.includes(term);
            if (exactMatch) {
                maxScore = Math.max(maxScore, 1.0);
                return;
            }

            const words = dealText.split(" ");
            words.forEach((word) => {
                if (word.length > 2) {
                    const similarity = calculateSimilarity(term, word);
                    if (similarity > 0.7) {
                        maxScore = Math.max(maxScore, similarity);
                    }
                }
            });
        });

        return { deal, score: maxScore };
    });

    return dealScores
        .filter((item) => item.score > 0.6)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map((item) => item.deal);
}

function getRandomGreeting(): string {
    const greetings = [
        "Great choice! Here's what I found:",
        "Perfect! I've got some amazing deals for you:",
        "Awesome! Check out these fantastic offers:",
        "Excellent! Here are some deals you'll love:",
        "Nice! I found some great options:",
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
}

function getRandomNoResults(): string {
    const responses = [
        "Hmm, I couldn't find exactly what you're looking for. How about trying some popular options like coffee, pizza, burgers, or sushi?",
        "No matches found for that search! Maybe try searching for coffee, pizza, burgers, sushi, or other tasty treats?",
        "Oops! Nothing came up for that. Why not search for something delicious like coffee, pizza, burgers, or sushi?",
        "I didn't find any deals matching that search. Try popular items like coffee, pizza, burgers, sushi, or sandwiches!",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
}

function getRandomContinue(): string {
    const continuations = [
        "What else are you craving? Just type it in!",
        "Hungry for more deals? Send me another search!",
        "Want to explore more? Just tell me what you're looking for!",
        "Need something else? Just let me know what you want to find!",
        "Keep the searches coming! What would you like next?",
    ];
    return continuations[Math.floor(Math.random() * continuations.length)];
}

function formatDealsResponse(deals: Deal[]): string {
    if (deals.length === 0) {
        return getRandomNoResults();
    }

    let response = `${getRandomGreeting()}\n\n`;

    deals.forEach((deal, index) => {
        response += `${index + 1}. *${deal.name}*\n`;
        response += `📍 ${deal.location}\n`;
        response += `🎉 ${deal.deal}\n`;
        response += `${deal.description}\n\n`;
    });

    response += getRandomContinue();
    return response;
}

function isGreeting(message: string): boolean {
    const normalized = normalizeText(message);
    const greetingWords = ["hi", "hello", "hey", "start", "begin"];
    const words = normalized.split(" ");
    return (
        greetingWords.some((greeting) => words.includes(greeting)) &&
        words.length <= 3
    );
}

function getWelcomeMessage(): string {
    return "Hey there! 👋 I'm your food deals finder! Just tell me what you're craving and I'll find the best deals for you.\n\nTry searching for: coffee, pizza, burgers, sushi, tacos, ice cream, or anything else you're in the mood for! 🍕☕🍔";
}

async function sendWhatsAppMessage(to: string, message: string): Promise<void> {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;

    if (!token || !phoneId) {
        throw new Error("Missing WhatsApp configuration");
    }

    const url = `https://graph.facebook.com/v15.0/${phoneId}/messages`;

    const payload = {
        messaging_product: "whatsapp",
        to: to,
        text: {
            body: message,
        },
    };

    const response = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`WhatsApp API error: ${error}`);
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === "GET") {
        const mode = req.query["hub.mode"];
        const token = req.query["hub.verify_token"];
        const challenge = req.query["hub.challenge"];

        if (
            mode === "subscribe" &&
            token === process.env.WEBHOOK_VERIFY_TOKEN
        ) {
            console.log("Webhook verified successfully!");
            res.status(200).send(challenge);
            return;
        }

        console.log("Webhook verification failed - token mismatch");
        res.status(403).send("Forbidden");
        return;
    }

    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }

    try {
        const body: WhatsAppWebhook = req.body;

        if (!body.entry || body.entry.length === 0) {
            res.status(200).send("OK");
            return;
        }

        const change = body.entry[0].changes?.[0];
        if (!change || !change.value.messages) {
            res.status(200).send("OK");
            return;
        }

        const message = change.value.messages[0];
        if (!message || message.type !== "text") {
            res.status(200).send("OK");
            return;
        }

        const userMessage = message.text.body;
        const userNumber = message.from;

        let responseMessage: string;

        if (isGreeting(userMessage)) {
            responseMessage = getWelcomeMessage();
        } else {
            const deals = findDeals(userMessage);
            responseMessage = formatDealsResponse(deals);
        }

        await sendWhatsAppMessage(userNumber, responseMessage);

        res.status(200).send("OK");
    } catch (error) {
        console.error("Webhook error:", error);
        res.status(200).send("OK");
    }
}
