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

// Define food-related categories
const FOOD_CATEGORIES = [
  "Bakery",
  "Dairy",
  "Food Cupboard",
  "Frozen",
  "Fruits & Vegetables",
  "Meat & Seafood",
  "Snacks & Confectionery",
];

// Special case for Rice category which has a different structure in the data
const FOOD_SUBCATEGORIES = ["Rice", "Noodles", "Oils & Seasoning", "Baby Food"];

// Advanced fuzzy matching function with category awareness
const fuzzyMatch = (ingredient, product) => {
  // First check if product is in a food category
  const isInFoodCategory =
    FOOD_CATEGORIES.includes(product.Category) ||
    FOOD_SUBCATEGORIES.includes(product.Subcategory);

  if (!isInFoodCategory) {
    return false; // Skip non-food items immediately
  }

  // Clean and normalize both strings
  const cleanIngredient = ingredient.toLowerCase().trim();
  const cleanProductName = product["Product Name"].toLowerCase().trim();

  // Direct match check - if product name contains the exact ingredient name
  if (cleanProductName.includes(cleanIngredient)) {
    return true;
  }

  // Word-by-word matching with higher threshold
  const ingredientWords = cleanIngredient
    .split(/\s+/)
    .filter((word) => word.length > 2);

  // If ingredient is a single word or very short, require stricter matching
  if (ingredientWords.length <= 1) {
    return cleanProductName.includes(cleanIngredient);
  }

  // For multi-word ingredients, check if most significant words are present
  const significantMatches = ingredientWords.filter((word) =>
    cleanProductName.includes(word)
  );

  // Require at least 75% of significant words to match for multi-word ingredients
  return significantMatches.length >= Math.ceil(ingredientWords.length * 0.75);
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
        {
          parts: [
            {
              text: `What ingredients do I need to make ${message}? Please list only the food ingredients, separated by commas. Do not include kitchen tools, utensils, or non-food items.`,
            },
          ],
        },
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

  // Helper function to find the best matching products for each ingredient
  const findBestMatchingProducts = (cleanedIngredients, productList) => {
    const matchedProductsByIngredient = {};

    // For each ingredient, find all matching products
    cleanedIngredients.forEach((ingredient) => {
      const matches = productList.filter((product) =>
        fuzzyMatch(ingredient, product)
      );

      if (matches.length > 0) {
        matchedProductsByIngredient[ingredient] = matches;
      }
    });

    // Flatten the matches into a single array, removing duplicates
    const allMatches = [];
    const seenProductNames = new Set();

    Object.entries(matchedProductsByIngredient).forEach(
      ([ingredient, products]) => {
        products.forEach((product) => {
          if (!seenProductNames.has(product["Product Name"])) {
            seenProductNames.add(product["Product Name"]);
            allMatches.push({
              ...product,
              matchedIngredient: ingredient, // Add the matched ingredient for reference
            });
          }
        });
      }
    );

    return {
      allMatches,
      matchedProductsByIngredient,
    };
  };

  // Helper function to categorize products by food category
  const categorizeProductsByFoodGroup = (products) => {
    const categorized = {};

    products.forEach((product) => {
      const category = product.Category;
      if (!categorized[category]) {
        categorized[category] = [];
      }
      categorized[category].push(product);
    });

    return categorized;
  };

  const handleSend = async (message) => {
    if (!message.trim()) return;

    const newMessage = { message, direction: "outgoing", sender: "User" };
    setMessages((prevMessages) => [...prevMessages, newMessage]);
    setIsTyping(true);

    const suggested = await callGeminiAPI(message);
    console.log("Suggested ingredients:", suggested);

    // Add validation for empty suggestions
    if (!suggested || suggested.length === 0) {
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

    // Clean Gemini's response
    const cleanSuggestions = suggested
      .map((ingredient) =>
        ingredient
          .replace(/\d+\.\s*/, "") // Remove numbering
          .replace(/\(.*?\)/g, "") // Remove parentheses content
          .trim()
      )
      .filter((ingredient) => ingredient.length > 0); // Remove empty strings

    setSuggestedIngredients(cleanSuggestions);

    // Use improved matching logic to find the best matching products
    const {
      allMatches,
      matchedProductsByIngredient,
    } = findBestMatchingProducts(cleanSuggestions, products);

    if (allMatches.length === 0) {
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          message: `I found these ingredients for ${message}, but none match your available products: ${cleanSuggestions.join(
            ", "
          )}`,
          sender: "Chatbot",
        },
      ]);
      setIsTyping(false);
      return;
    }

    // Group products by matched ingredient for better organization
    const matchedIngredients = Object.keys(matchedProductsByIngredient);
    const unmatchedIngredients = cleanSuggestions.filter(
      (ingredient) => !matchedIngredients.includes(ingredient)
    );

    // Categorize matched products by food group
    const categorizedProducts = categorizeProductsByFoodGroup(allMatches);

    setIngredientOptions(allMatches);
    setShowChecklist(true);
    setSelectedItems([]);

    // Create a more informative message about matched and unmatched ingredients
    let ingredientMessage = `Gemini suggests you need these ingredients: ${cleanSuggestions.join(
      ", "
    )}`;

    if (unmatchedIngredients.length > 0) {
      ingredientMessage += `\n\nI couldn't find matches for: ${unmatchedIngredients.join(
        ", "
      )}`;
    }

    setMessages((prevMessages) => [
      ...prevMessages,
      {
        message: ingredientMessage,
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

    // Extract aisle numbers from selected items
    const aisles = [
      ...new Set(
        selectedItems
          .map((item) => item["Aisle Number"])
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
                      (Aisle: {product["Aisle Number"]})
                      {product.matchedIngredient && (
                        <span style={{ color: "green", marginLeft: "5px" }}>
                          (Matches: {product.matchedIngredient})
                        </span>
                      )}
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
