import React, {useState,useEffect,useRef} from "react";
import {MessageSquare,Send,X} from "lucide-react";

const ChatBox = ({solution,onScrollToSection}) => {
    const [isOpen,setIsOpen] = useState(false);
    const [messages,setMessages] = useState([]);
    const [userInput,setUserInput] = useState('');
    const [isLoading,setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const isSolutionAvailable = !!solution;

    const CHAT_API_URL = '/api/chat';
    const CHAT_MODEL = 'llama-3.1-8b-instant';

    useEffect(() => {
        if(messagesEndRef.current) {
            messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
        }
    },[messages]);

    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setMessages([
                {
                    role:'bot',
                    content: isSolutionAvailable ? "Hello! I can answer questions about this application or help you navigate the current solution. Try asking: 'Jump to Cost Analysis' or 'What is the implementation language?'":"Hello! I can answer basic questions about this application. Upload an RFP and generate a solution to ask me about its content!"
                }
            ]);
        }
    },[isOpen,isSolutionAvailable]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if(!userInput.trim()) return;

        const userMessage =userInput.trim();
        setMessages((prev)=>[...prev,{role:'user',content:userMessage}]);
        setUserInput('');
        setIsLoading(true);

        try{
            const requestBody = {
                message:userMessage,
                solution_title: solution ? solution.title : null,
                solution_content: solution ? JSON.stringify(solution.content) : null,
                model: CHAT_MODEL,
            };
            const response = await fetch(CHAT_API_URL,{
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body: JSON.stringify(requestBody),
            });
            if(!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            const botMessage = data.response;
            const action = data.action;

            // 1. Handle Agent Action (Jump to Section)
            if (action && action.type === 'jump_to' && action.section) {
                // Trigger the scroll action in the parent component (App.js)
                onScrollToSection(action.section); 
                
                // Add a confirmation message to the chat
                setMessages(prev => [...prev, {
                    role: 'bot', 
                    content: `Okay! Navigating to the "${action.section.replace(/-/g, ' ')}" section.`
                }]);
            } else if (botMessage === "I can only answer proposal-related questions.") {
                setMessages(prev => [
                    ...prev,
                    { role: 'bot', content: "I can only answer proposal-related questions." },
                ]);
            } else {
                // 2. Handle Standard Response
                setMessages(prev => [...prev, {role: 'bot', content: botMessage}]);
            }
        }
        catch(error){
            console.error('Chat API Error:', error);
            setMessages((prev) => [...prev, { role: 'bot', content: 'An error occurred while communicating with the server.' }]);
        }
        finally{
            setIsLoading(false);
        }
    };

    return (
        // Chat window now floats over the application content
        <div className="fixed bottom-4 right-4 z-50">
            {/* The Chat button itself (unchanged) */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 transition"
            >
                {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
            </button>
            
            {/* Chat Window */}
            {isOpen && (
                // Positioned relative to the floating button
                <div className="absolute bottom-16 right-0 bg-white border border-gray-200 rounded-lg shadow-xl flex flex-col h-[400px] w-80">
                    {/* Header */}
                    <div className="p-3 border-b border-gray-200 flex justify-between items-center">
                        <h3 className="font-semibold text-indigo-600 flex items-center">
                            <MessageSquare size={18} className="mr-2" /> AI Assistant
                        </h3>
                        <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-700">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div ref={messagesEndRef} className="flex-grow p-4 overflow-y-auto space-y-4 text-sm">
                        {messages.map((msg, index) => (
                            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-2 rounded-lg shadow-sm ${msg.role === 'user' ? 'bg-indigo-500 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-tl-none'}`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                        <div className="flex justify-start">
                            <div className="p-2 rounded-lg text-sm bg-gray-200 text-gray-800 rounded-tl-none">
                            <div className="animate-pulse">Typing...</div>
                            </div>
                        </div>
                        )}
                    </div>

                    {/* Input */}
                    <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-200 flex">
                        <input
                        type="text"
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        placeholder={isSolutionAvailable ? "Ask a question or 'jump to X'" : "Type a message..."}
                        className="flex-grow p-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                        disabled={isLoading}
                        />
                        <button
                        type="submit"
                        className="p-2 bg-indigo-600 text-white rounded-r-lg hover:bg-indigo-700 disabled:bg-indigo-400"
                        disabled={!userInput.trim() || isLoading}
                        >
                        <Send size={20} />
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default ChatBox