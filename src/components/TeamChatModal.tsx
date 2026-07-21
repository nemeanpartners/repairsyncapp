import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, query, onSnapshot, addDoc, serverTimestamp, doc, getDocs, orderBy, where, limitToLast } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send, Users, User, Circle, Maximize2, Minimize2, ChevronLeft, Menu, Paperclip, Smile, X, Loader2 } from 'lucide-react';
import { MentionsInput, Mention } from 'react-mentions';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface TeamMember {
  email: string;
  role: string;
  displayName?: string;
}

interface ChatMessage {
  id: string;
  text: string;
  senderEmail: string;
  senderUid: string;
  channel: string; // 'general' or 'email1:email2'
  timestamp: any;
}

interface TeamChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserEmail: string;
}

export const TeamChatModal: React.FC<TeamChatModalProps> = ({ isOpen, onClose, currentUserEmail }) => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [activeChannel, setActiveChannel] = useState<'general' | string>('general');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [modalSize, setModalSize] = useState({ width: 1000, height: 700 });
  const [isModalResizing, setIsModalResizing] = useState(false);
  const modalResizePos = useRef({ startW: 0, startH: 0, startX: 0, startY: 0 });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && isOpen) {
        // Only if we haven't rendered yet or something, but actually 
        // we can just let it be true and hide the chat area.
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [isOpen]);

  const startResizing = React.useCallback((mouseDownEvent: React.MouseEvent) => {
    setIsResizing(true);
  }, []);

  const stopResizing = React.useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = React.useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing) {
        const newWidth = mouseMoveEvent.clientX - 20; // Adjusting for dialog padding if necessary
        if (newWidth > 150 && newWidth < 500) {
          setSidebarWidth(newWidth);
        }
      }
    },
    [isResizing]
  );
  
  const startModalResize = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsModalResizing(true);
    modalResizePos.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: modalSize.width,
      startH: modalSize.height
    };
  }, [modalSize]);
  
  const handleModalResize = React.useCallback((e: MouseEvent) => {
    if (isModalResizing) {
      e.preventDefault();
      // Dialog is centered, so expanding bottom right corner by 10px means width logic:
      // if center stays same, mouse move right 10px means width needs to grow by 20px so right edge hits mouse pointer.
      // Wait, Dialog has `translate-x-1/2`, so its center is fixed at 50%.
      const deltaX = e.clientX - modalResizePos.current.startX;
      const deltaY = e.clientY - modalResizePos.current.startY;
      
      setModalSize({
        width: Math.max(400, Math.min(window.innerWidth * 0.95, modalResizePos.current.startW + deltaX * 2)),
        height: Math.max(300, Math.min(window.innerHeight * 0.95, modalResizePos.current.startH + deltaY * 2))
      });
    }
  }, [isModalResizing]);
  
  const stopModalResize = React.useCallback(() => {
    setIsModalResizing(false);
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  useEffect(() => {
    if (isModalResizing) {
      window.addEventListener("mousemove", handleModalResize);
      window.addEventListener("mouseup", stopModalResize);
      return () => {
        window.removeEventListener("mousemove", handleModalResize);
        window.removeEventListener("mouseup", stopModalResize);
      };
    }
  }, [isModalResizing, handleModalResize, stopModalResize]);

  useEffect(() => {
    // Only fetch members once or if they are empty
    if (isOpen && members.length === 0) {
      const fetchMembers = async () => {
        try {
          const q = query(collection(db, 'users'), where('role', '!=', '')); // basic filter
          const snapshot = await getDocs(q);
          const data = snapshot.docs.map(doc => ({
            email: doc.id,
            role: doc.data().role,
            displayName: doc.data().displayName,
          })) as TeamMember[];
          setMembers(data);
        } catch (error) {
          console.error('Error fetching members:', error);
        }
      };
      fetchMembers();
    }
  }, [isOpen, members.length]);

  useEffect(() => {
    if (isOpen && currentUserEmail) {
      setIsLoadingMessages(true);
      const q = query(
        collection(db, 'team_messages'),
        where('channel', '==', activeChannel),
        orderBy('timestamp', 'asc'),
        limitToLast(50)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ChatMessage[];
        setMessages(msgs);
        setIsLoadingMessages(false);
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        }, 100);
      }, (error) => {
        console.error('Snapshot error:', error);
        setIsLoadingMessages(false);
      });

      return () => unsubscribe();
    }
  }, [isOpen, activeChannel, currentUserEmail]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !auth.currentUser) return;

    setIsSending(true);
    try {
      await addDoc(collection(db, 'team_messages'), {
        text: newMessage.trim(),
        senderEmail: currentUserEmail,
        senderUid: auth.currentUser.uid,
        channel: activeChannel,
        timestamp: serverTimestamp()
      });
      setNewMessage('');
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const determineChannelId = (user1: string, user2: string) => {
    return [user1, user2].sort().join(':');
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className={`p-0 flex flex-col overflow-hidden bg-zinc-50 border-border/40 shadow-xl transition-[opacity,border-radius,background-color] duration-300 ease-in-out ${
          isFullScreen 
            ? '!w-full !h-full !max-w-none !max-h-none rounded-none border-none left-0 top-0 translate-x-0 translate-y-0' 
            : `!max-w-none w-[95vw] sm:w-auto h-[90vh] sm:h-auto rounded-2xl ${isModalResizing ? 'select-none' : ''}`
        }`} 
        style={!isFullScreen && window.innerWidth >= 640 ? { width: modalSize.width, height: modalSize.height } : undefined}
        showCloseButton={false}
      >
        <div className={`flex h-full w-full relative ${isResizing ? 'select-none cursor-col-resize' : ''}`}>
          {/* Sidebar */}
          <div 
            style={{ width: showSidebar ? (isMobile ? '100%' : (isFullScreen ? sidebarWidth + 40 : sidebarWidth)) : 0 }}
            className={`bg-white border-r border-border/40 flex flex-col overflow-hidden relative z-20 shadow-sm shrink-0 ${!isResizing ? 'transition-[width] duration-300' : ''}`}
          >
            <div className="p-5 border-b border-border/40 flex items-center justify-between shrink-0 select-none">
              <h2 className="font-black text-xl flex items-center gap-2 text-zinc-800">
                <MessageSquare className="w-6 h-6 text-primary fill-primary/10" />
                Team Chat
              </h2>
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setShowSidebar(false)}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-6">
                
                {/* Channels */}
                <div>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide pl-2 mb-2">Channels</h3>
                  <button
                    onClick={() => {
                      setActiveChannel('general');
                      if (isMobile) setShowSidebar(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                      activeChannel === 'general' 
                        ? 'bg-primary/10 text-primary font-bold' 
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    General
                  </button>
                </div>

                {/* Direct Messages */}
                <div>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide pl-2 mb-2">Direct Messages</h3>
                  <div className="space-y-1">
                    {members.filter(m => m.email !== currentUserEmail).map(member => {
                      const dmChannel = determineChannelId(currentUserEmail, member.email);
                      const isActive = activeChannel === dmChannel;
                      return (
                        <button
                          key={member.email}
                          onClick={() => {
                            setActiveChannel(dmChannel);
                            if (isMobile) setShowSidebar(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                            isActive 
                              ? 'bg-primary/10 text-primary font-bold' 
                              : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                          }`}
                        >
                          <div className="relative">
                            <Avatar className="w-6 h-6 border bg-white">
                              <AvatarFallback className="text-xs font-medium bg-primary/5 text-primary">
                                {(member.displayName ? member.displayName.charAt(0) : member.email.charAt(0)).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <Circle className="w-2.5 h-2.5 absolute -bottom-0.5 -right-0.5 text-green-500 fill-green-500 border-2 border-white rounded-full" />
                          </div>
                          <span className="truncate flex-1 text-left">{member.displayName || member.email.split('@')[0]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>
            </ScrollArea>
            <div className="p-4 border-t border-border/40 bg-zinc-50 flex items-center justify-between">
               <div className="flex items-center gap-2">
                 <Avatar className="w-8 h-8 border bg-white shadow-sm">
                    <AvatarFallback className="text-xs bg-primary text-white font-bold">
                       {(members.find(m => m.email === currentUserEmail)?.displayName?.charAt(0) || currentUserEmail.charAt(0)).toUpperCase()}
                    </AvatarFallback>
                 </Avatar>
                 <div className="flex flex-col">
                   <span className="text-xs font-bold text-zinc-800 leading-tight">{members.find(m => m.email === currentUserEmail)?.displayName || currentUserEmail.split('@')[0]}</span>
                   <span className="text-xs text-green-600 font-bold">Online</span>
                 </div>
               </div>
               <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-zinc-500 hover:text-zinc-800">
                 <span className="sr-only">Close</span>
                 &times;
               </Button>
            </div>
          </div>

          {/* Resizer Handle */}
          {showSidebar && !isMobile && (
            <div
              onMouseDown={startResizing}
              className={`w-1.5 h-full cursor-col-resize hover:bg-primary/20 active:bg-primary/40 transition-colors z-30 shrink-0 -translate-x-1/2 ${isResizing ? 'bg-primary/40' : 'bg-transparent'}`}
            />
          )}

          {/* Chat Area */}
          <div className={`flex-1 flex flex-col bg-slate-50/50 min-w-0 ${isMobile && showSidebar ? 'hidden' : ''}`}>
            {/* Header */}
            <div className="h-16 px-4 md:px-6 border-b border-border/40 bg-white flex items-center justify-between shrink-0 shadow-sm z-10">
              <div className="flex items-center gap-3">
                {!showSidebar && (
                  <Button variant="ghost" size="icon" onClick={() => setShowSidebar(true)} className="mr-1">
                    <Menu className="w-5 h-5" />
                  </Button>
                )}
                {activeChannel === 'general' ? (
                  <>
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-zinc-800"># General</h3>
                      <p className="text-xs text-muted-foreground hidden sm:block">Team-wide discussions</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Avatar className="w-10 h-10 border shadow-sm">
                      <AvatarFallback className="bg-primary/5 text-primary font-bold">
                        {activeChannel.replace(currentUserEmail, '').replace(':', '').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-bold text-zinc-800">{activeChannel.replace(currentUserEmail, '').replace(':', '').split('@')[0]}</h3>
                      <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                        <Circle className="w-1.5 h-1.5 fill-current" /> Active now
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="hidden md:flex text-zinc-500 hover:text-primary transition-colors"
                  title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
                >
                  {isFullScreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={onClose} className="text-zinc-500 hover:text-red-500 transition-colors">
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 min-h-0 min-w-0 overflow-y-auto p-6 space-y-6" ref={scrollRef}>
              {isLoadingMessages ? (
                <div className="h-full flex flex-col items-center justify-center space-y-4">
                  <Loader2 className="w-8 h-8 text-primary animate-spin opacity-50" />
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Hydrating channel...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-50 space-y-4">
                  <MessageSquare className="w-12 h-12 text-zinc-400" />
                  <div>
                    <h4 className="font-bold text-zinc-700">No messages yet</h4>
                    <p className="text-sm text-zinc-500">Break the ice and say hello!</p>
                  </div>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isMe = msg.senderEmail === currentUserEmail;
                  const showHeader = idx === 0 || messages[idx - 1].senderEmail !== msg.senderEmail || (msg.timestamp?.toDate()?.getTime() - messages[idx - 1].timestamp?.toDate()?.getTime() > 5 * 60 * 1000);
                  
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${showHeader ? 'mt-6' : 'mt-1'}`}>
                      {showHeader && (
                        <div className={`flex items-baseline gap-2 mb-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                          <span className="text-xs font-bold text-zinc-700">
                            {members.find(m => m.email === msg.senderEmail)?.displayName || msg.senderEmail.split('@')[0]}
                          </span>
                          <span className="text-xs text-zinc-400 font-medium">
                            {msg.timestamp?.toDate() ? format(msg.timestamp.toDate(), 'h:mm a') : 'Now'}
                          </span>
                        </div>
                      )}
                      
                      <div className="flex items-end gap-2 max-w-[80%]">
                        {!isMe && showHeader && (
                          <Avatar className="w-8 h-8 border mt-1 shrink-0 bg-white">
                            <AvatarFallback className="text-xs font-bold">
                              {(members.find(m => m.email === msg.senderEmail)?.displayName?.charAt(0) || msg.senderEmail.charAt(0)).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        {!isMe && !showHeader && <div className="w-8 shrink-0" />}
                        
                        <div 
                          className={`px-4 py-2.5 rounded-2xl sm:rounded-2xl break-words whitespace-pre-wrap text-sm shadow-sm ${
                            isMe 
                              ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                              : 'bg-white border text-zinc-800 rounded-tl-sm'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input area */}
            <div className="p-4 bg-white border-t border-border/40 shrink-0">
              <form 
                onSubmit={handleSendMessage} 
                className="flex items-end gap-2 bg-zinc-50 border border-border/40 rounded-2xl px-4 py-2 focus-within:ring-2 focus-within:ring-primary/20 transition-all shadow-inner"
              >
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 hover:text-zinc-600 rounded-full shrink-0">
                  <Paperclip className="w-5 h-5" />
                </Button>
                
                <MentionsInput
                  placeholder={activeChannel === 'general' ? 'Message #General...' : 'Type a message...'}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="mentions-input flex-1 min-h-[40px] max-h-32 bg-transparent text-sm py-2.5 px-1 w-full relative"
                  onKeyDown={(e: any) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                  style={{
                    control: {
                      fontSize: '0.875rem',
                      fontWeight: 'normal',
                    },
                    input: {
                      margin: 0,
                      outline: 'none',
                      border: 'none',
                      padding: 0,
                      width: '100%',
                      height: '100%',
                      backgroundColor: 'transparent'
                    },
                    suggestions: {
                      list: {
                        backgroundColor: 'white',
                        border: '1px solid rgba(0,0,0,0.1)',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                        fontSize: '0.875rem',
                      },
                      item: {
                        padding: '8px 12px',
                        borderBottom: '1px solid rgba(0,0,0,0.05)',
                      },
                    },
                  }}
                >
                  <Mention
                    trigger="@"
                    data={members.map(m => ({ id: m.email, display: m.displayName || m.email.split('@')[0] }))}
                    displayTransform={(id, display) => `@${display}`}
                    markup="@[__display__](__id__)"
                    style={{
                      backgroundColor: '#e0f2fe',
                      borderRadius: '4px',
                      padding: '2px',
                    }}
                  />
                </MentionsInput>
                
                <div className="flex items-center gap-1 shrink-0">
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-zinc-400 hover:text-zinc-600 rounded-full">
                    <Smile className="w-5 h-5" />
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={!newMessage.trim() || isSending}
                    className="rounded-full w-12 h-12 p-0 bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/20 transition-transform active:scale-95"
                  >
                    <Send className="w-5 h-5 ml-1" />
                    <span className="sr-only">Send</span>
                  </Button>
                </div>
              </form>
              <p className="text-xs text-zinc-400 mt-2 text-center font-medium">
                Press Enter to send, Shift + Enter for new line
              </p>
            </div>
            
            {/* Modal Resize Handle */}
            {!isFullScreen && (
              <div 
                className="absolute right-0 bottom-0 w-6 h-6 cursor-nwse-resize z-50 flex items-center justify-center opacity-50 hover:opacity-100"
                onMouseDown={startModalResize}
              >
                <div className="w-2.5 h-2.5 border-r-2 border-b-2 border-zinc-400 rounded-sm translate-x-[-4px] translate-y-[-4px]" />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
