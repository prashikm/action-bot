const express = require("express");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const { OpenAI } = require("openai");

const app = express();
const PORT = 3000;

dotenv.config();

app.set("view engine", "ejs");
app.use(bodyParser.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_SECRET_KEY });

const INITIAL_SYSTEM_PROMPT = `You are an AI assistant for a bookstore called "PageTurner Books". 
Your role is to assist customers with book recommendations, answer questions about book availability, 
discuss literary topics, and help with general inquiries about the store. 
The store specializes in both new releases and rare, vintage books. 
It also hosts regular book club meetings and author signings. 
Be friendly, knowledgeable, and always try to spark interest in books and reading. Keep the response short and concise.`;

let conversationHistory = [{ role: "system", content: INITIAL_SYSTEM_PROMPT }];

app.get("/", (req, res) => {
  res.render("index");
});

async function detectMeetingIntent(message) {
  const prompt = `
    Analyze the following message and determine if the user is expressing an intent to schedule or book a meeting. 
    Consider various languages and cultural contexts. 
    Respond with either "Yes" if there's a meeting intent, or "No" if there isn't.

    User message: "${message}"

    Meeting intent (Yes/No):
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 5,
      temperature: 0.1,
    });

    const intent = response.choices[0].message.content.trim().toLowerCase();
    return intent === "yes";
  } catch (error) {
    console.error("Error detecting meeting intent:", error);
    return false;
  }
}

app.post("/chat", async (req, res) => {
  const { query } = req.body;
  conversationHistory.push({ role: "user", content: query });

  const isMeetingIntent = await detectMeetingIntent(query);

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        ...conversationHistory,
        isMeetingIntent
          ? {
              role: "system",
              content:
                "The user has expressed interest in scheduling a meeting. First analyze the users's query and if it's explicitly for a meeting, respond with: 'Book a meeting' else response normally by asking the user for their name and email.",
            }
          : {
              role: "system",
              content: "Respond to user's query based on the previous context",
            },
      ],
      model: "gpt-4o-mini",
      max_tokens: 32,
    });

    res.json({
      response: completion.choices[0].message.content,
      intent: isMeetingIntent,
    });
  } catch (error) {
    console.error("Error generating response:", error);
    res.json({ error: "An error occurred while generating the response." });
  }
});

app.post("/book-meeting", async (req, res) => {
  const { name, email } = req.body;

  console.log("Booking details:", name, email);

  // TODO: Implement meeting booking logic to save the meeting details in a database
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log("Server is running on port http://localhost:3000");
});
