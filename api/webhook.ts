/**
 * WhatsApp Webhook Handler for Deal-Quest-Bot
 *
 * This module processes incoming WhatsApp messages, extracts search queries,
 * finds relevant deals from the catalog, and responds with formatted results.
 * It also handles webhook verification for the WhatsApp Business API.
 *
 * @module webhook
 */

import { VercelRequest, VercelResponse } from "@vercel/node";
import catalog from "./catalog.json";

/**
 * Interface representing a deal in the catalog
 * @interface Deal
 */
interface Deal {
    /** Unique identifier for the deal */
    id: number;
    /** Name of the business or restaurant */
    name: string;
    /** Category of food or service (e.g., "pizza", "coffee") */
    category: string;
    /** Physical location or address */
    location: string;
    /** Short description of the offer or discount */
    deal: string;
    /** Detailed description of the deal */
    description: string;
}

/**
 * Interface representing a message received from WhatsApp
 * @interface WhatsAppMessage
 */
interface WhatsAppMessage {
    /** Phone number of the sender */
    from: string;
    /** Unique message identifier */
    id: string;
    /** Timestamp when the message was sent */
    timestamp: string;
    /** Text content of the message */
    text: {
        /** The actual message body */
        body: string;
    };
    /** Type of message (e.g., "text") */
    type: string;
}

/**
 * Interface representing the webhook payload from WhatsApp Business API
 * @interface WhatsAppWebhook
 */
interface WhatsAppWebhook {
    /** Array of entry objects containing changes */
    entry: Array<{
        /** Array of change objects */
        changes: Array<{
            /** Value object containing messages and metadata */
            value: {
                /** Optional array of messages received */
                messages?: WhatsAppMessage[];
                /** Metadata about the WhatsApp Business account */
                metadata: {
                    /** ID of the phone number that received the message */
                    phone_number_id: string;
                };
            };
        }>;
    }>;
}

/**
 * Normalizes text by converting to lowercase, removing special characters,
 * and standardizing whitespace
 *
 * @param {string} text - The text to normalize
 * @returns {string} Normalized text
 */
function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Calculates similarity between two strings using Levenshtein distance
 * and normalizes the result to a value between 0 and 1
 *
 * @param {string} str1 - First string to compare
 * @param {string} str2 - Second string to compare
 * @returns {number} Similarity score between 0 and 1, where 1 is exact match
 */
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

/**
 * Extracts meaningful search terms from a query by filtering out common
 * greetings and short words
 *
 * @param {string} query - The search query to process
 * @returns {string[]} Array of extracted search terms
 */
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

/**
 * Finds deals matching a search query by calculating similarity scores
 * and returning the top matches
 *
 * @param {string} query - The search query from the user
 * @returns {Deal[]} Array of matching deals, sorted by relevance
 */
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

/**
 * Returns a random greeting message to introduce search results
 *
 * @returns {string} A randomly selected greeting message
 */
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

/**
 * Returns a random message for when no results are found
 *
 * @returns {string} A randomly selected "no results" message
 */
function getRandomNoResults(): string {
    const responses = [
        "Hmm, I couldn't find exactly what you're looking for. How about trying some popular options like coffee, pizza, burgers, or sushi?",
        "No matches found for that search! Maybe try searching for coffee, pizza, burgers, sushi, or other tasty treats?",
        "Oops! Nothing came up for that. Why not search for something delicious like coffee, pizza, burgers, or sushi?",
        "I didn't find any deals matching that search. Try popular items like coffee, pizza, burgers, sushi, or sandwiches!",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
}

/**
 * Returns a random continuation prompt to encourage further interaction
 *
 * @returns {string} A randomly selected continuation message
 */
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

/**
 * Formats a list of deals into a user-friendly WhatsApp message
 *
 * @param {Deal[]} deals - Array of deals to format
 * @returns {string} Formatted message with deal information
 */
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

/**
 * Determines if a message is a greeting based on common greeting words
 *
 * @param {string} message - The message to check
 * @returns {boolean} True if the message is a greeting, false otherwise
 */
function isGreeting(message: string): boolean {
    const normalized = normalizeText(message);
    const greetingWords = ["hi", "hello", "hey", "start", "begin"];
    const words = normalized.split(" ");
    return (
        greetingWords.some((greeting) => words.includes(greeting)) &&
        words.length <= 3
    );
}

/**
 * Returns a welcome message for new users or greeting responses
 *
 * @returns {string} The welcome message with instructions
 */
function getWelcomeMessage(): string {
    return "Hey there! 👋 I'm your food deals finder! Just tell me what you're craving and I'll find the best deals for you.\n\nTry searching for: coffee, pizza, burgers, sushi, tacos, ice cream, or anything else you're in the mood for! 🍕☕🍔";
}

/**
 * Sends a message to a user via the WhatsApp Business API
 *
 * @param {string} to - The recipient's phone number
 * @param {string} message - The message to send
 * @returns {Promise<void>} A promise that resolves when the message is sent
 * @throws {Error} If WhatsApp configuration is missing or API call fails
 */
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

/**
 * Vercel serverless function that handles WhatsApp webhook requests
 *
 * Handles two types of requests:
 * 1. GET: For webhook verification by WhatsApp Business API
 * 2. POST: For processing incoming messages and sending responses
 *
 * @param {VercelRequest} req - The incoming HTTP request
 * @param {VercelResponse} res - The HTTP response object
 * @returns {Promise<void>} A promise that resolves when the response has been sent
 *
 * @example
 * // Webhook verification request
 * GET /api/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=CHALLENGE
 *
 * @example
 * // Incoming message webhook
 * POST /api/webhook
 * {
 *   "entry": [{
 *     "changes": [{
 *       "value": {
 *         "messages": [{
 *           "from": "1234567890",
 *           "id": "message-id",
 *           "timestamp": "timestamp",
 *           "text": { "body": "Find pizza deals" },
 *           "type": "text"
 *         }],
 *         "metadata": { "phone_number_id": "phone-id" }
 *       }
 *     }]
 *   }]
 * }
 */
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
