document.getElementById("summarize").addEventListener("click", async () => {
  const resultDiv = document.getElementById("result");
  const loader = document.getElementById("loader");

  // Show loader and clear previous result
  loader.style.display = "block";
  resultDiv.textContent = "";

  // 1. Get the user's API key from Chrome storage
  chrome.storage.sync.get(['geminiApiKey'], async ({ geminiApiKey }) => {
    if (!geminiApiKey) {
      loader.style.display = "none";
      resultDiv.textContent = "No API key set. Click the gear icon to add one.";
      return;
    }

    // 2. Ask content.js for page text
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab || !tab.id) {
        loader.style.display = "none";
        resultDiv.textContent = "Could not find the active tab.";
        return;
      }

      chrome.tabs.sendMessage(tab.id, { type: "GET_ARTICLE_TEXT" }, async (response) => {
        loader.style.display = "none";

        if (chrome.runtime.lastError) {
          resultDiv.textContent = "⚠️ Could not connect to content script.";
          return;
        }

        const text = response?.text;

        if (!text) {
          resultDiv.textContent = "No article text found.";
          return;
        }

        // ✅ Use the correct summary type from the <select>
        const summaryType = document.getElementById("summary-type")?.value || "brief";

        try {
          const summary = await getGeminisummary(text, summaryType, geminiApiKey);
          resultDiv.textContent = summary;
        } catch (error) {
          resultDiv.textContent = "Gemini error: " + error.message;
        }
      });
    });
  });
});

async function getGeminisummary(rawText, type, apiKey) {
  const max = 20000;
  const text = rawText.length > max ? rawText.slice(0, max) + "..." : rawText;

  const promptMap = {
    brief: `Summarize in 2-3 sentences:\n\n${text}`,
    detailed: `Give a detailed summary:\n\n${text}`,
    bullets: `Summarize in 5-7 bullet points (start each line with " - "):\n\n${text}`,
  };

  const prompt = promptMap[type] || promptMap.brief;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.6 },
      }),
    }
  );

  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(error?.message || "Request failed");
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "No summary";
}

// ✅ Copy to clipboard button
document.getElementById("copy-btn").addEventListener("click", () => {
  const txt = document.getElementById("result").innerText;
  if (!txt) return;

  navigator.clipboard.writeText(txt).then(() => {
    const btn = document.getElementById("copy-btn");
    const old = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => (btn.textContent = old), 2000);
  });
});
