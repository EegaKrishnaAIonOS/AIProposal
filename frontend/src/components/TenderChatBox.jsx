import React, {useState, useEffect, useRef} from "react";
import {MessageSquare, Send, X} from "lucide-react";

const TenderChatBox = ({tenders, onScrollToSection}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const isTendersAvailable = !!tenders && tenders.length > 0;

    const CHAT_API_URL = '/api/tender-chat';

    useEffect(() => {
        if(messagesEndRef.current) {
            messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setMessages([
                {
                    role: 'bot',
                    content: isTendersAvailable 
                        ? `Hello! I can help you with questions about the ${tenders.length} tenders currently displayed. You can ask me about specific tenders, sectors, deadlines, values, or any other details. Try asking: 'Show me tenders from GEM' or 'What's the deadline for the first tender?'`
                        : "Hello! I can help you with questions about tenders. I have access to real-time tender data and can answer questions about specific tenders, sectors, deadlines, values, and other details. Try asking: 'Show me tenders from GEM' or 'What tenders are available today?'"
                }
            ]);
        }
    }, [isOpen, isTendersAvailable, tenders]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if(!userInput.trim()) return;

        const userMessage = userInput.trim();
        setMessages((prev) => [...prev, {role: 'user', content: userMessage}]);
        setUserInput('');
        setIsLoading(true);

        try {
            // Prepare tender data for context
            const tenderData = isTendersAvailable ? tenders.map((tender, index) => ({
                tender_id: tender.tender_id,
                title: tender.title,
                organization: tender.organization,
                sector: tender.sector,
                deadline: tender.deadline,
                value: tender.value,
                source: tender.source,
                url: tender.url,
                description: tender.description || ''
            })) : [];

            const requestBody = {
                message: userMessage,
                tender_data: tenderData
            };

            const response = await fetch(CHAT_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (response.ok) {
                const data = await response.json();
                const botMessage = data.response || 'I apologize, but I could not process your request.';
                setMessages((prev) => [...prev, {role: 'bot', content: botMessage}]);
            } else {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Failed to get response from chat API');
            }
        } catch(error) {
            console.error('Chat API Error:', error);
            setMessages((prev) => [...prev, {role: 'bot', content: 'An error occurred while communicating with the server.'}]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        // Chat window now floats over the application content
        <div className="fixed bottom-4 right-4 z-50">
            {/* The Chat button itself */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="bg-purple-600 text-white p-4 rounded-full shadow-lg hover:bg-purple-700 transition"
            >
                {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
            </button>
            
            {/* Chat Window */}
            {isOpen && (
                // Positioned relative to the floating button
                <div className="absolute bottom-16 right-0 bg-white border border-gray-200 rounded-lg shadow-xl flex flex-col h-[400px] w-80">
                    {/* Header */}
                    <div className="p-3 border-b border-gray-200 flex justify-between items-center">
                        <h3 className="font-semibold text-purple-600 flex items-center">
                            <MessageSquare size={18} className="mr-2" /> Tender Assistant
                        </h3>
                        <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-700">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div 
                        ref={messagesEndRef}
                        className="flex-1 overflow-y-auto p-3 space-y-3"
                        style={{maxHeight: '300px'}}
                    >
                        {messages.map((message, index) => (
                            <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-2 rounded-lg ${
                                    message.role === 'user' 
                                        ? 'bg-purple-600 text-white' 
                                        : 'bg-gray-100 text-gray-800'
                                }`}>
                                    <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-gray-100 text-gray-800 p-2 rounded-lg">
                                    <div className="text-sm">Thinking...</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="p-3 border-t border-gray-200">
                        <form onSubmit={handleSendMessage} className="flex gap-2">
                            <input
                                type="text"
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                placeholder="Ask about tenders..."
                                className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                                disabled={isLoading}
                            />
                            <button
                                type="submit"
                                disabled={isLoading || !userInput.trim()}
                                className="bg-purple-600 text-white p-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Send size={16} />
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TenderChatBox;
