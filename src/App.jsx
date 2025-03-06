import { useEffect, useState } from "react";
import "./App.css";
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  MessageInput,
  TypingIndicator,
} from "@chatscope/chat-ui-kit-react";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Fuzzy matching function
const fuzzyMatch = (ingredient, productName) => {
  const ingredientWords = ingredient.toLowerCase().split(" ");
  const productWords = productName.toLowerCase().split(" ");
  return ingredientWords.some((word) => productWords.includes(word));
};

// Supermarket Map Component (Highlights Selected Aisles)
function SupermarketMap({ selectedAisles }) {
  const aisles = Array.from({ length: 21 }, (_, i) => `Aisle ${i + 1}`);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: "10px",
        margin: "20px 0",
      }}
    >
      {aisles.map((aisle) => (
        <div
          key={aisle}
          style={{
            width: "80px",
            height: "80px",
            textAlign: "center",
            lineHeight: "80px",
            border: "2px solid black",
            backgroundColor: selectedAisles.includes(aisle)
              ? "lightgreen"
              : "white",
          }}
        >
          {aisle}
        </div>
      ))}
    </div>
  );
}

function App() {
  const [messages, setMessages] = useState([
    {
      message:
        "Hello, I'm your AI shopping assistant! Ask me what you need for any meal!",
      sentTime: "just now",
      sender: "Chatbot",
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [products, setProducts] = useState([]);
  const [showChecklist, setShowChecklist] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [showMap, setShowMap] = useState(false);
  const [highlightedAisles, setHighlightedAisles] = useState([]);
  const [ingredientOptions, setIngredientOptions] = useState([]);
  const [suggestedIngredients, setSuggestedIngredients] = useState([]);

  useEffect(() => {
    fetch("/csvjson.json")
      .then((response) => response.json())
      .then((data) => {
        console.log("Fetched product data:", data);
        setProducts(data);
      })
      .catch((error) => console.error("Error fetching JSON:", error));
  }, []);

  const callGeminiAPI = async (message) => {
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

    const requestBody = {
      contents: [
        { parts: [{ text: `What ingredients do I need to make ${message}?` }] },
      ],
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        console.error(
          "Gemini API error:",
          response.status,
          response.statusText
        );
        return [];
      }

      const data = await response.json();
      console.log("Gemini API Response:", data);

      if (data.candidates && data.candidates.length > 0) {
        return data.candidates[0].content.parts[0].text
          .split(",")
          .map((item) => item.trim());
      } else {
        return [];
      }
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      return [];
    }
  };

  const handleSend = async (message) => {
    if (!message.trim()) return;

    const newMessage = { message, direction: "outgoing", sender: "User" };
    setMessages((prevMessages) => [...prevMessages, newMessage]);
    setIsTyping(true);

    const suggested = await callGeminiAPI(message);
    console.log("Suggested ingredients:", suggested);

    if (suggested.length === 0) {
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          message: `I couldn't find ingredients for ${message}.`,
          sender: "Chatbot",
        },
      ]);
      setIsTyping(false);
      return;
    }

    setSuggestedIngredients(suggested);

    const matchedProducts = products.filter((product) =>
      suggested.some((ingredient) =>
        fuzzyMatch(ingredient, product["Product Name"])
      )
    );

    if (matchedProducts.length === 0) {
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          message: `I found these ingredients for ${message}, but none match your available products.`,
          sender: "Chatbot",
        },
      ]);
      setIsTyping(false);
      return;
    }

    setIngredientOptions(matchedProducts);
    setShowChecklist(true);
    setSelectedItems([]);

    setMessages((prevMessages) => [
      ...prevMessages,
      {
        message: `Gemini suggests you need these ingredients: ${suggested.join(
          ", "
        )}`,
        sender: "Chatbot",
      },
      {
        message: `Here are the ingredients available for ${message}. Select what you need:`,
        sender: "Chatbot",
      },
    ]);

    setIsTyping(false);
  };

  const handleGetOptimizedRoute = () => {
    if (selectedItems.length === 0) return;

    // Extract aisle numbers from selected items (fixing missing aisle issue)
    const aisles = [
      ...new Set(
        selectedItems
          .map((item) => item["Aisle"])
          .filter((aisle) => aisle && aisle !== "Not Available")
          .map((aisle) => `Aisle ${aisle}`)
      ),
    ];

    console.log("Selected Aisles:", aisles);
    setHighlightedAisles(aisles);
    setShowMap(true);

    setMessages((prevMessages) => [
      ...prevMessages,
      {
        message: "Here is the optimized route based on your selected items:",
        sender: "Chatbot",
      },
    ]);
  };

  return (
    <div className="App">
      <div style={{ position: "relative", height: "800px", width: "700px" }}>
        <MainContainer>
          <ChatContainer>
            <MessageList
              scrollBehavior="smooth"
              typingIndicator={
                isTyping ? (
                  <TypingIndicator content="Chatbot is typing..." />
                ) : null
              }
            >
              {messages.map((message, i) => (
                <Message
                  key={i}
                  model={{
                    message: message.message,
                    sentTime: message.sentTime,
                    sender: message.sender,
                    direction:
                      message.sender === "User" ? "outgoing" : "incoming",
                  }}
                />
              ))}

              {showChecklist && (
                <div
                  style={{
                    padding: "10px",
                    background: "#f8f8f8",
                    borderRadius: "5px",
                    margin: "10px 0",
                  }}
                >
                  <p>Select your ingredients:</p>
                  {ingredientOptions.map((product, index) => (
                    <div key={index} style={{ marginBottom: "5px" }}>
                      <input
                        type="checkbox"
                        onChange={(e) => {
                          const selected = e.target.checked
                            ? [...selectedItems, product]
                            : selectedItems.filter(
                                (i) =>
                                  i["Product Name"] !== product["Product Name"]
                              );
                          setSelectedItems(selected);
                        }}
                        style={{ marginRight: "8px" }}
                      />
                      {product["Product Name"]} - ${product["Price ($)"]}{" "}
                      (Aisle: {product["Aisle"]})
                    </div>
                  ))}
                  <button onClick={handleGetOptimizedRoute}>
                    Get Optimized Route
                  </button>
                </div>
              )}

              {showMap && <SupermarketMap selectedAisles={highlightedAisles} />}
            </MessageList>
            <MessageInput placeholder="Type a message..." onSend={handleSend} />
          </ChatContainer>
        </MainContainer>
      </div>
    </div>
  );
}

export default App;
