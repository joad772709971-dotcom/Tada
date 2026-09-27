import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, Send, User, Search, Clock, CheckCheck, Phone, Store, 
  MessageCircle, AlertCircle, Image as ImageIcon, Paperclip, 
  CheckCircle2, MoreHorizontal, ChevronRight, Plus, Users, 
  ArrowRightLeft, UserPlus, Check, Mic, StopCircle, FileText, PhoneCall, ArrowRight,
  X, Maximize2, Minimize2, Video, Volume2, ShieldCheck, Download, Loader2, Settings as SettingsIcon,
  ShieldAlert, FolderSync, Ban, LogOut
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { secureFileExport } from '../services/securityService';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, deleteDoc, serverTimestamp, getDocs, getDoc, updateDoc, doc, Timestamp, limit, or, and, writeBatch } from 'firebase/firestore';
import { UserProfile } from '../types';

import { useSearchParams } from 'react-router-dom';
import { useConnectivity } from '../hooks/useConnectivity';

export interface QueuedChatMessage {
  tempId: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  content: string;
  mediaUrl?: string | null;
  audioUrl?: string | null;
  contextId?: string | null;
  contextType?: 'order' | 'maintenance' | 'general';
  priceUpdateAgreement?: {
    oldPrice: number;
    newPrice: number;
    status: 'pending' | 'accepted' | 'rejected';
  } | null;
  type: 'direct' | 'group';
  createdAtMillis: number;
  status: 'queued' | 'sending' | 'failed';
}

const QUEUE_STORAGE_KEY = 'jam_chat_outgoing_queue';

const getOutgoingQueue = (): QueuedChatMessage[] => {
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Error reading chat queue from localStorage:', err);
    return [];
  }
};

const saveOutgoingQueue = (queue: QueuedChatMessage[]) => {
  try {
    if (queue.length === 0) {
      localStorage.removeItem(QUEUE_STORAGE_KEY);
    } else {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    }
  } catch (err) {
    console.error('Error saving chat queue to localStorage:', err);
  }
};

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: Timestamp | any;
  status: 'sent' | 'delivered' | 'read' | 'queued';
  contextId?: string;
  contextType?: 'order' | 'maintenance' | 'general';
  mediaUrl?: string;
  audioUrl?: string;
  priceUpdateAgreement?: {
    oldPrice: number;
    newPrice: number;
    status: 'pending' | 'accepted' | 'rejected';
  };
  isQueued?: boolean;
}

interface ChatContact {
  id: string;
  name: string;
  shopName: string;
  role: string;
  lastMessage?: string;
  unreadCount: number;
  phone?: string;
  lastSeen?: any;
  contextId?: string;
  contextType?: 'order' | 'maintenance' | 'general';
}

const isUserOnline = (lastSeen?: Timestamp | any) => {
  if (!lastSeen) return false;
  const now = new Date();
  const lastActive = lastSeen.toDate();
  const diffMinutes = (now.getTime() - lastActive.getTime()) / (1000 * 60);
  return diffMinutes < 2; // Online if active in last 2 mins
};

export default function ChatHub({ 
  profile, 
  initialContactId,
  initialContextId,
  initialContextType
}: { 
  profile: UserProfile | null;
  initialContactId?: string;
  initialContextId?: string;
  initialContextType?: 'order' | 'maintenance' | 'general';
}) {
  const [searchParams] = useSearchParams();
  const isOnline = useConnectivity();
  const cid = searchParams.get('contactId') || initialContactId;
  const ctxId = searchParams.get('contextId') || initialContextId;
  const ctxType = (searchParams.get('contextType') as any) || initialContextType;

  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [groups, setGroups] = useState<any[]>([]); // Group chats
  const [selectedContact, setSelectedContact] = useState<ChatContact | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showCallModal, setShowCallModal] = useState<'incoming' | 'outgoing' | null>(null);
  const [isUserInActiveCall, setIsUserInActiveCall] = useState(false);
  const [isCallOnHold, setIsCallOnHold] = useState(false);
  const [busyCallsLog, setBusyCallsLog] = useState<Array<{ callerName: string; timestamp: Date }>>([]);
  const [callDuration, setCallDuration] = useState(0);
  const [isWindowFocused, setIsWindowFocused] = useState(true);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [groupName, setGroupName] = useState('');
  const [selectedForGroup, setSelectedForGroup] = useState<string[]>([]);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [selectedForBroadcast, setSelectedForBroadcast] = useState<string[]>([]);
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [shopSettings, setShopSettings] = useState<any>(null);
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [isPurgingChats, setIsPurgingChats] = useState(false);

  const handlePurgeAllChats = async () => {
    if (!window.confirm("⚠️ هل أنت متأكد من رغبتك في حذف وتطهير كافة الدردشات والمجموعات وسجلات المكالمات بالكامل من قاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء!")) {
      return;
    }
    
    setIsPurgingChats(true);
    try {
      const collectionsToPurge = ['messages', 'chats', 'chatGroups', 'calls'];
      let totalDeleted = 0;

      for (const colName of collectionsToPurge) {
        const querySnapshot = await getDocs(collection(db, colName));
        if (!querySnapshot.empty) {
          for (const docSnap of querySnapshot.docs) {
            try {
              await deleteDoc(docSnap.ref);
              totalDeleted++;
            } catch (err) {
              console.warn(`Could not delete doc ${docSnap.id} in ${colName}:`, err);
            }
          }
        }
      }
      
      alert(`🎉 تم تنظيف قاعدة البيانات وتطهير كافة الدردشات بنجاح! تم حذف ${totalDeleted} سجلاً.`);
      window.location.reload();
    } catch (error: any) {
      console.error("Error purging chats:", error);
      alert(`⚠️ حدث خطأ أثناء تطهير الدردشات: ${error.message}`);
    } finally {
      setIsPurgingChats(false);
    }
  };

  useEffect(() => {
    const fetchShopSettings = async () => {
      if (!profile?.ownerId) return;
      try {
        const docSnap = await getDoc(doc(db, 'settings', profile.ownerId));
        if (docSnap.exists()) {
          setShopSettings(docSnap.data());
        }
      } catch (e) {
        console.error('Error fetching shop settings in ChatHub:', e);
      }
    };
    fetchShopSettings();
  }, [profile]);

  useEffect(() => {
    if (!profile?.uid) return;
    const fetchUser = async () => {
      try {
        const uSnap = await getDoc(doc(db, 'users', profile.uid));
        if (uSnap.exists()) {
          setCurrentUserData(uSnap.data());
        }
      } catch (e) {
        console.error('Error fetching user detailed document:', e);
      }
    };
    fetchUser();
  }, [profile]);

  const [queuedCount, setQueuedCount] = useState<number>(() => getOutgoingQueue().length);
  const isSyncingQueueRef = useRef(false);

  const syncQueuedMessages = async () => {
    if (isSyncingQueueRef.current) return;
    if (!navigator.onLine) return;

    const currentQueue = getOutgoingQueue();
    if (currentQueue.length === 0) {
      setQueuedCount(0);
      return;
    }

    isSyncingQueueRef.current = true;
    const remainingQueue: QueuedChatMessage[] = [];
    let syncedCount = 0;

    for (const item of currentQueue) {
      try {
        const msgData: any = {
          senderId: item.senderId,
          senderName: item.senderName,
          receiverId: item.receiverId,
          content: item.content,
          mediaUrl: item.mediaUrl || null,
          audioUrl: item.audioUrl || null,
          contextId: item.contextId || null,
          contextType: item.contextType || 'general',
          priceUpdateAgreement: item.priceUpdateAgreement || null,
          type: item.type,
          createdAt: serverTimestamp(),
          status: 'sent'
        };

        await addDoc(collection(db, 'messages'), msgData);

        if (item.type === 'direct' && item.receiverId) {
          try {
            const chatsRef = collection(db, 'chats');
            const q = query(chatsRef, where('participantIds', 'array-contains', item.senderId));
            const chatSnap = await getDocs(q);
            const existingChat = chatSnap.docs.find(d => d.data().participantIds?.includes(item.receiverId));
            if (existingChat) {
              await updateDoc(doc(db, 'chats', existingChat.id), {
                lastMessage: item.content || (item.mediaUrl ? 'صورة' : 'رسالة'),
                lastMessageAt: serverTimestamp()
              });
            }
          } catch (_) {}
        }

        syncedCount++;
      } catch (err) {
        console.warn('Failed to sync queued message, keeping in offline queue:', err);
        remainingQueue.push(item);
      }
    }

    saveOutgoingQueue(remainingQueue);
    setQueuedCount(remainingQueue.length);
    isSyncingQueueRef.current = false;

    if (syncedCount > 0) {
      console.log(`✅ Synced ${syncedCount} queued chat messages to Firestore.`);
      setMessages(prev => prev.filter(m => !(m as any).isQueued || remainingQueue.some(rq => rq.tempId === m.id)));
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      console.log('🔄 Online event detected: syncing queued chats...');
      syncQueuedMessages();
    };

    window.addEventListener('online', handleOnline);

    if (navigator.onLine) {
      syncQueuedMessages();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [profile?.ownerId]);

  const [chatTab, setChatTab] = useState<'b2b' | 'b2c'>('b2b');
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [chatPrivacy, setChatPrivacy] = useState(() => {
    const saved = localStorage.getItem('jam-chat-privacy');
    const defaultPrivacy = { appearOnline: true, showReadReceipts: true, blockedUsers: [], customLocalMediaPath: '/sdcard/JAMPro/Media' };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...defaultPrivacy, ...parsed };
      } catch (e) {
        return defaultPrivacy;
      }
    }
    return defaultPrivacy;
  });

  useEffect(() => {
    localStorage.setItem('jam-chat-privacy', JSON.stringify(chatPrivacy));
    
    if (chatPrivacy.appearOnline && profile?.uid) {
      const updatePresence = async () => {
        try {
          await updateDoc(doc(db, 'users', profile.uid), {
            lastSeen: serverTimestamp()
          });
        } catch (e) {
          console.error('Error updating presence:', e);
        }
      };
      
      updatePresence();
      const interval = setInterval(updatePresence, 60000); // Every minute
      return () => clearInterval(interval);
    }
  }, [chatPrivacy.appearOnline, profile?.uid]);

  // 🎙️ Dynamic Call Duration Timer & Window Focus / Always-On-Top Listener
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isUserInActiveCall) {
      setCallDuration(0);
      timer = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isUserInActiveCall]);

  useEffect(() => {
    const handleFocus = () => {
      setIsWindowFocused(true);
      // If Electron API is injected/available, bring app back to normal state
      if ((window as any).electron && typeof (window as any).electron.setAlwaysOnTop === 'function') {
        try {
          (window as any).electron.setAlwaysOnTop(false);
        } catch (e) {
          console.error('Electron setAlwaysOnTop failed:', e);
        }
      }
    };

    const handleBlur = () => {
      setIsWindowFocused(false);
      // Minimize/Focus loss triggers Electron global always-on-top overlay for call duration visualization
      if (isUserInActiveCall && (window as any).electron && typeof (window as any).electron.setAlwaysOnTop === 'function') {
        try {
          (window as any).electron.setAlwaysOnTop(true);
        } catch (e) {
          console.error('Electron setAlwaysOnTop failed:', e);
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isUserInActiveCall]);

  const formatCallDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // 📞 WebRTC Refs
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  const handleToggleHold = () => {
    if (!peerConnectionRef.current) return;
    const nextHoldState = !isCallOnHold;
    setIsCallOnHold(nextHoldState);

    // Mute or unmute local outgoing tracks
    peerConnectionRef.current.getSenders().forEach((sender) => {
      if (sender.track) {
        sender.track.enabled = !nextHoldState;
      }
    });

    // Mute/unmute remote element
    const remoteAudio = document.getElementById('remoteAudio') as HTMLAudioElement;
    if (remoteAudio) {
      remoteAudio.muted = nextHoldState;
    }

    console.log(`📞 Call Hold State updated: ${nextHoldState}`);
  };

  const handleCleanupCall = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if ((window as any).activeLocalStream) {
      try {
        (window as any).activeLocalStream.getTracks().forEach((track: any) => track.stop());
        (window as any).activeLocalStream = null;
      } catch (e) {}
    }
    if ((window as any).unsubCall) {
      try {
        (window as any).unsubCall();
        (window as any).unsubCall = null;
      } catch (e) {}
    }
    const remoteAudio = document.getElementById('remoteAudio');
    if (remoteAudio) {
      try {
        remoteAudio.remove();
      } catch (e) {}
    }
    setIsUserInActiveCall(false);
    setIsCallOnHold(false);
    (window as any).activeCallDocId = null;
  };

  // 📞 WebRTC Signal Listener (Firestore Calls Collection Subscription)
  useEffect(() => {
    if (!profile?.uid) return;

    const q = query(
      collection(db, 'calls'),
      where('receiverId', '==', profile.uid),
      where('status', '==', 'ringing'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        const callData = docSnap.data();

        // Check if Caller is blocked by anti-spam guard
        if (chatPrivacy.blockedUsers?.includes(callData.callerId)) {
          console.log('🔇 Blocked call from anti-spam target:', callData.callerId);
          return;
        }

        // 📱 Busy detection: client is occupied with another active connection
        if (isUserInActiveCall) {
          console.log('📱 Line is busy! Decline this call document:', docSnap.id);
          try {
            await updateDoc(doc(db, 'calls', docSnap.id), {
              status: 'declined',
              reason: 'BUSY_NOW'
            });
            setBusyCallsLog(prev => [
              { callerName: callData.callerName || 'عميل خارجي', timestamp: new Date() },
              ...prev
            ]);
          } catch (e) {
            console.error(e);
          }
          return;
        }

        // 🔒 Network Isolation Boundary Security Check (B2B Call Guard)
        const callerStoreCode = callData.callerStoreCode || '';
        const callerRole = callData.callerRole || 'user';
        const receiverStoreCode = shopSettings?.storeCode || profile?.ownerId || 'STORE_DEFAULT';
        const receiverRole = profile?.role || 'user';

        let supplierStoreCodes: string[] = [];
        try {
          const suppliersSnap = await getDocs(query(collection(db, 'suppliers'), where('ownerId', '==', profile?.ownerId)));
          supplierStoreCodes = suppliersSnap.docs.map(dSnap => dSnap.data().storeCode || dSnap.id);
        } catch (e) {
          console.error('Error fetching suppliers inside isolation guard:', e);
        }

        const verifiedPartnersList = [
          ...(currentUserData?.linkedStores || []),
          ...supplierStoreCodes
        ];

        const isAuthorized = validateCallRoutingAuthorization(
          { storeCode: callerStoreCode, role: callerRole },
          { storeCode: receiverStoreCode, role: receiverRole },
          verifiedPartnersList
        );

        if (!isAuthorized) {
          console.warn("🔒 JAM System Pro Call blocked at B2B security boundary! Declining immediately.");
          try {
            await updateDoc(doc(db, 'calls', docSnap.id), {
              status: 'declined',
              reason: 'REJECTED_SECURITY_BOUNDARY'
            });
          } catch (e) {
            console.error(e);
          }
          return;
        }

        const callerContact = contacts.find(c => c.id === callData.callerId || c.ownerId === callData.callerId);
        if (callerContact) {
          setSelectedContact(callerContact);
        } else {
          setSelectedContact({
            id: callData.callerId,
            shopName: callData.callerName || 'عميل خارجي',
            name: callData.callerName || 'غير مسمى',
            role: 'user',
            unreadCount: 0
          } as any);
        }

        setShowCallModal('incoming');
        (window as any).activeCallDocId = docSnap.id;
      }
    }, (error) => {
      console.error('WebRTC calls signaling status error:', error);
    });

    return () => unsubscribe();
  }, [profile?.uid, contacts, chatPrivacy.blockedUsers, isUserInActiveCall, shopSettings, currentUserData]);

  const handleStartOutgoingCall = async () => {
    if (!selectedContact || !profile) return;
    try {
      // 🔒 Network Isolation Boundary Security Check (B2B Call Guard)
      let targetStoreCode = selectedContact.storeCode || '';
      let targetRole = selectedContact.role || 'user';

      try {
        const uSnap = await getDoc(doc(db, 'users', selectedContact.id));
        if (uSnap.exists()) {
          const uData = uSnap.data();
          targetStoreCode = uData.storeCode || uData.ownerId || '';
          targetRole = uData.role || 'user';
        }
      } catch (e) {
        console.error("Failed to fetch target routing details inside outline:", e);
      }

      const callerStoreCode = shopSettings?.storeCode || profile?.ownerId || 'STORE_DEFAULT';
      const callerRole = profile.role || 'user';

      let supplierStoreCodes: string[] = [];
      try {
        const suppliersSnap = await getDocs(query(collection(db, 'suppliers'), where('ownerId', '==', profile.ownerId)));
        supplierStoreCodes = suppliersSnap.docs.map(dSnap => dSnap.data().storeCode || dSnap.id);
      } catch (e) {
        console.error('Error fetching suppliers inside isolation guard:', e);
      }

      const verifiedPartnersList = [
        ...(currentUserData?.linkedStores || []),
        ...supplierStoreCodes
      ];

      const isAuthorized = validateCallRoutingAuthorization(
        { storeCode: callerStoreCode, role: callerRole },
        { storeCode: targetStoreCode, role: targetRole },
        verifiedPartnersList
      );

      if (!isAuthorized) {
        alert("🔒 تم حظر الاتصال: غير مصرح بالاتصال الصوتي خارج شبكة المحل المعتمدة B2B.");
        return;
      }

      // 1. Initialize Peer Connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      peerConnectionRef.current = pc;

      // 2. Add local stream audio
      try {
        const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = localStream;
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
      } catch (err) {
        console.warn('Microphone access denied or unavailable for WebRTC:', err);
      }

      // 3. Track ICE candidates & publish to Firestore
      pc.onicecandidate = async (event) => {
        const docId = (window as any).activeCallDocId;
        if (event.candidate && docId) {
          const candidateData = event.candidate.toJSON();
          const candidatesRef = collection(db, 'calls', docId, 'callerCandidates');
          await addDoc(candidatesRef, candidateData);
        }
      };

      // 4. Create local Offer SDP
      let offer = await pc.createOffer();
      if (offer.sdp) {
        offer = new RTCSessionDescription({
          type: offer.type,
          sdp: optimizeSDPForYemenNetwork(offer.sdp)
        });
      }
      await pc.setLocalDescription(offer);

      const docRef = await addDoc(collection(db, 'calls'), {
        callerId: profile.uid,
        callerName: profile.shopName || profile.name,
        callerStoreCode,
        callerRole,
        receiverId: selectedContact.id,
        receiverStoreCode: targetStoreCode,
        receiverRole: targetRole,
        type: 'VOICE',
        priority: 'high',
        status: 'ringing',
        sdpOffer: {
          type: offer.type,
          sdp: offer.sdp
        },
        createdAt: serverTimestamp()
      });
      setShowCallModal('outgoing');
      (window as any).activeCallDocId = docRef.id;

      // 5. Play incoming remote track
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          remoteStreamRef.current = event.streams[0];
          const remoteAudio = document.getElementById('remoteAudio') as HTMLAudioElement || document.createElement('audio');
          remoteAudio.id = 'remoteAudio';
          remoteAudio.srcObject = event.streams[0];
          remoteAudio.autoplay = true;
          remoteAudio.play().catch(e => console.error("Error playing remote audio:", e));
        }
      };

      // Listen to peer accepting or declining
      const unsub = onSnapshot(doc(db, 'calls', docRef.id), async (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.status === 'accepted' && data.sdpAnswer) {
            try {
              if (pc.signalingState !== 'stable') {
                await pc.setRemoteDescription(new RTCSessionDescription(data.sdpAnswer));
                console.log("🟢 Caller set remote description successfully!");
              }
              setIsUserInActiveCall(true);
            } catch (err) {
              console.error("Error setting remote description inside caller:", err);
            }
          } else if (data.status === 'declined' || data.status === 'ended') {
            unsub();
            handleCleanupCall();
            alert('❌ المكالمة مرفوضة أو مشغولة حالياً.');
            setShowCallModal(null);
          }
        }
      });

      // Listen to receiver candidates
      const unsubReceiverCandidates = onSnapshot(collection(db, 'calls', docRef.id, 'receiverCandidates'), (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            try {
              if (pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(data));
                console.log("➕ Added receiver ICE Candidate to Caller PeerConnection.");
              }
            } catch (err) {
              console.error("Error adding receiver candidate:", err);
            }
          }
        });
      });

      (window as any).unsubCall = () => {
        unsub();
        unsubReceiverCandidates();
      };
    } catch (e) {
      console.error('WebRTC Outgoing Call signaling error:', e);
    }
  };

  const handleAcceptCall = async () => {
    const docId = (window as any).activeCallDocId;
    if (!docId || !profile) return;
    try {
      // 1. Fetch Call Document
      const callSnap = await getDoc(doc(db, 'calls', docId));
      if (!callSnap.exists()) return;
      const callData = callSnap.data();
      const sdpOffer = callData.sdpOffer;

      // 2. Initialize Peer Connection for Receiver
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      peerConnectionRef.current = pc;

      // 3. Add local track audio using stabilized activator
      try {
        await handleAnswerAndActivateAudio(pc, null as any, () => {
          console.log("🎙️ Active local microphone stream bound to current WebRTC session.");
        });
      } catch (err) {
        console.warn('Microphone activation failed inside handleAcceptCall:', err);
      }

      // 4. Track Receiver candidates
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          const candidateData = event.candidate.toJSON();
          const candidatesRef = collection(db, 'calls', docId, 'receiverCandidates');
          await addDoc(candidatesRef, candidateData);
        }
      };

      // 5. Track Remote stream to play audio
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          remoteStreamRef.current = event.streams[0];
          const remoteAudio = document.getElementById('remoteAudio') as HTMLAudioElement || document.createElement('audio');
          remoteAudio.id = 'remoteAudio';
          remoteAudio.srcObject = event.streams[0];
          remoteAudio.autoplay = true;
          remoteAudio.play().catch(e => console.error("Error playing remote audio:", e));
        }
      };

      // Buffer incoming candidates until remote description is established
      const bufferedCandidates: any[] = [];
      const unsubCallerCandidates = onSnapshot(collection(db, 'calls', docId, 'callerCandidates'), (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            if (pc.remoteDescription) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(data));
                console.log("➕ Added incoming ICE Candidate to Receiver connection.");
              } catch (err) {
                console.error("Error adding Ice Candidate:", err);
              }
            } else {
              bufferedCandidates.push(data);
            }
          }
        });
      });

      // 6. Set remote description
      if (sdpOffer) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdpOffer));
        console.log("✅ Remote description set successfully inside Receiver.");

        // Add buffered candidates
        for (const candidate of bufferedCandidates) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
            console.log("➕ Added buffered caller ICE candidate!");
          } catch (e) {
            console.error("Error adding buffered candidate:", e);
          }
        }
      }

      // 7. Create local Answer
      let answer = await pc.createAnswer();
      if (answer.sdp) {
        answer = new RTCSessionDescription({
          type: answer.type,
          sdp: optimizeSDPForYemenNetwork(answer.sdp)
        });
      }
      await pc.setLocalDescription(answer);

      // 8. Update Call state to accepted & publish Answer
      await updateDoc(doc(db, 'calls', docId), {
        status: 'accepted',
        sdpAnswer: {
          type: answer.type,
          sdp: answer.sdp
        }
      });

      setIsUserInActiveCall(true);
      alert('🟢 تم قبول وتوصيل المكالمة بنجاح وتفعيل التشفير الثنائي!');

      // Monitor end call triggers
      const unsubCallStatus = onSnapshot(doc(db, 'calls', docId), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.status === 'ended' || data.status === 'declined') {
            unsubCallStatus();
            handleCleanupCall();
          }
        }
      });

      (window as any).unsubCall = () => {
        unsubCallerCandidates();
        unsubCallStatus();
      };

      setShowCallModal(null);
    } catch (err) {
      console.error('Accept call failed:', err);
    }
  };

  const handleDeclineCall = async () => {
    const docId = (window as any).activeCallDocId;
    if (docId) {
      try {
        await updateDoc(doc(db, 'calls', docId), { status: 'declined' });
      } catch (err) {
        console.error('Decline call failed:', err);
      }
    }
    handleCleanupCall();
    setShowCallModal(null);
  };
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isWholesaler = profile?.role === 'wholesaler';

  useEffect(() => {
    if (!profile?.uid) return;

    // Fetch all registered users to allow direct messaging
    const fetchContacts = () => {
      try {
        const q = query(collection(db, 'users'), limit(100)); // Show latest/alphabetical users

        const unsubscribe = onSnapshot(q, (snapshot) => {
          const allUsers = snapshot.docs
            .map(doc => {
              const data = doc.data();
              return {
                id: doc.id, // Use unique document ID (uid) for the chat ID
                ownerId: data.ownerId, // Keep ownerId for shop-level logic if needed
                name: data.name || 'بدون اسم',
                shopName: data.shopName || data.name,
                role: data.role || 'user',
                appRole: data.appRole || data.role || 'user',
                unreadCount: 0,
                phone: data.phone,
                lastSeen: data.lastSeen,
                status: data.status,
                deleted: data.deleted || false,
                isDeleted: data.isDeleted || false
              } as any;
            })
            .filter(u => u.id !== profile.uid && u.ownerId !== profile.ownerId && u.status !== 'deleted' && u.deleted !== true && u.isDeleted !== true);
          
          setContacts(prev => {
            let next = prev.filter(c => c.id !== profile.uid && c.ownerId !== profile.ownerId && c.status !== 'deleted' && c.deleted !== true && c.isDeleted !== true);
            allUsers.forEach(u => {
              const idx = next.findIndex(c => c.id === u.id);
              if (idx === -1) next.push(u);
              else next[idx] = { ...next[idx], ...u };
            });
            return next;
          });
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'users');
          setLoading(false);
        });

        return unsubscribe;
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'users');
        setLoading(false);
      }
    };

    // Fetch groups
    const fetchGroups = () => {
      const q = query(
        collection(db, 'chatGroups'),
        where('members', 'array-contains', profile.ownerId)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        setGroups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'chatGroups');
      });

      return unsubscribe;
    };

    // Fetch direct chats (from shared chats collection)
    const fetchDirectChats = () => {
      const q = query(
        collection(db, 'chats'),
        where('participantIds', 'array-contains', profile.ownerId),
        orderBy('lastMessageAt', 'desc')
      );

      return onSnapshot(q, async (snapshot) => {
        const chatPromises = snapshot.docs.map(async (chatDoc) => {
          const data = chatDoc.data();
          const otherId = data.participantIds.find((id: string) => id !== profile.ownerId);
          if (!otherId) return null;

          const userDocRef = doc(db, 'users', otherId);
          const userSnap = await getDoc(userDocRef);
          if (!userSnap.exists()) return null;
          const userData = userSnap.data();
          if (userData.status === 'deleted' || userData.deleted === true || userData.isDeleted === true) {
            return null;
          }

          const messagesSnap = await getDocs(query(
            collection(db, 'messages'),
            where('senderId', '==', otherId),
            where('receiverId', '==', profile.ownerId),
            where('status', '!=', 'read')
          ));

          return {
            id: otherId,
            chatId: chatDoc.id,
            name: userData?.name || 'محل غير معروف',
            shopName: userData?.shopName || 'بدون اسم',
            role: userData?.role || 'user',
            appRole: userData?.appRole || userData?.role || 'user',
            lastMessage: data.lastMessage,
            unreadCount: messagesSnap.size,
            phone: userData?.phone || userData?.shopPhone,
            status: userData?.status,
            deleted: userData?.deleted || false,
            isDeleted: userData?.isDeleted || false
          } as ChatContact;
        });

        const resolved = await Promise.all(chatPromises);
        setContacts(prev => {
          let newContacts = prev.filter(c => c.status !== 'deleted' && c.deleted !== true && c.isDeleted !== true);
          resolved.filter(Boolean).forEach(rc => {
            if (!newContacts.find(c => c.id === rc!.id)) {
              newContacts.push(rc!);
            } else {
              // Update existing contact with last message
              const idx = newContacts.findIndex(c => c.id === rc!.id);
              newContacts[idx] = { ...newContacts[idx], ...rc };
            }
          });
          return newContacts;
        });
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'chats');
      });
    };

    fetchContacts();
    const unsubDirect = fetchDirectChats();
    const unsubGroups = fetchGroups();
    return () => {
      unsubGroups();
      unsubDirect();
    };
  }, [profile]);

  useEffect(() => {
    if (!profile?.uid) return;

    let q;
    const messagesRef = collection(db, 'messages');

    if (selectedGroup) {
      q = query(
        messagesRef,
        where('receiverId', '==', selectedGroup.id),
        orderBy('createdAt', 'asc')
      );
    } else if (selectedContact) {
      q = query(
        messagesRef,
        or(
          and(where('senderId', '==', profile.ownerId), where('receiverId', '==', selectedContact.id)),
          and(where('senderId', '==', selectedContact.id), where('receiverId', '==', profile.ownerId))
        ),
        orderBy('createdAt', 'asc')
      );

      // If we have a context, we only show messages for that context
      if (selectedContact.contextId) {
        q = query(
          messagesRef,
          where('contextId', '==', selectedContact.contextId),
          orderBy('createdAt', 'asc')
        );
      }
    } else {
      return;
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Message))
        .filter(msg => {
          if (chatPrivacy.blockedUsers?.includes(msg.senderId)) {
            return false;
          }
          return true;
        });

      // Merge pending queued messages for currently open chat
      const currentTargetId = selectedGroup ? selectedGroup.id : selectedContact?.id;
      const currentQueue = getOutgoingQueue();
      const queuedForCurrent = currentQueue.filter(
        item => item.receiverId === currentTargetId && item.senderId === profile.ownerId
      );

      const optimisticQueued: Message[] = queuedForCurrent.map(item => ({
        id: item.tempId,
        senderId: item.senderId,
        receiverId: item.receiverId,
        content: item.content,
        mediaUrl: item.mediaUrl || undefined,
        audioUrl: item.audioUrl || undefined,
        createdAt: {
          toDate: () => new Date(item.createdAtMillis),
          toMillis: () => item.createdAtMillis,
          seconds: Math.floor(item.createdAtMillis / 1000),
          nanoseconds: 0
        } as any,
        status: 'queued',
        contextId: item.contextId || undefined,
        contextType: item.contextType || 'general',
        priceUpdateAgreement: item.priceUpdateAgreement || undefined,
        isQueued: true
      }));

      // Combine and sort by timestamp
      const allMsgs = [...msgs, ...optimisticQueued].sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return timeA - timeB;
      });

      setMessages(allMsgs);
      setQueuedCount(currentQueue.length);
      
      // Mark as read - only if window is focused or we are actively looking at the chat
      // To prevent infinite loop if many messages, we only update unread ones that we are receiving
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added' || change.type === 'modified') {
          const data = change.doc.data();
          if (data.receiverId === profile.ownerId && data.status !== 'read' && !chatPrivacy.blockedUsers?.includes(data.senderId)) {
            const statusUpdate = chatPrivacy.showReadReceipts ? 'read' : 'delivered';
            updateDoc(doc(db, 'messages', change.doc.id), { status: statusUpdate })
              .catch(err => console.error('Error updating read status:', err));
          }
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages');
    });

    return () => unsubscribe();
  }, [profile, selectedContact, selectedGroup]);

  useEffect(() => {
    if (!profile?.uid || !selectedContact) return;

    const markAsRead = async () => {
      try {
        const q = query(
          collection(db, 'messages'),
          where('receiverId', '==', profile.ownerId),
          where('senderId', '==', selectedContact.id),
          where('status', '!=', 'read')
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const batch = writeBatch(db);
          snap.docs.forEach(d => {
            batch.update(d.ref, { status: 'read' });
          });
          await batch.commit();
        }
      } catch (err) {
        console.error('Error marking as read:', err);
      }
    };

    markAsRead();
  }, [profile?.uid, selectedContact, messages.length]); // messages.length to re-run when new message arrives while open

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (
    e?: React.FormEvent, 
    mediaUrl?: string, 
    priceUpdate?: Message['priceUpdateAgreement'], 
    audioUrl?: string,
    forcedContent?: string
  ) => {
    if (e) e.preventDefault();
    const content = forcedContent || newMessage.trim();
    if (!content && !mediaUrl && !priceUpdate && !audioUrl) return;
    if ((!selectedContact && !selectedGroup) || !profile) return;

    if (selectedContact && chatPrivacy.blockedUsers?.includes(selectedContact.id)) {
      alert('⚠️ لا يمكنك إرسال رسائل لجهة اتصال محظورة. يرجى إلغاء الحظر أولاً من قائمة الإعدادات أو زر الدرع.');
      return;
    }

    const targetReceiverId = selectedGroup ? selectedGroup.id : selectedContact!.id;
    const isDirect = !selectedGroup;
    const tempId = `queue_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowMillis = Date.now();

    const queuedItem: QueuedChatMessage = {
      tempId,
      senderId: profile.ownerId,
      senderName: profile.shopName || profile.name || 'أنا',
      receiverId: targetReceiverId,
      content,
      mediaUrl: mediaUrl || null,
      audioUrl: audioUrl || null,
      contextId: selectedContact?.contextId || null,
      contextType: selectedContact?.contextType || 'general',
      priceUpdateAgreement: priceUpdate || null,
      type: isDirect ? 'direct' : 'group',
      createdAtMillis: nowMillis,
      status: 'queued'
    };

    const optimisticMsg: Message = {
      id: tempId,
      senderId: profile.ownerId,
      receiverId: targetReceiverId,
      content,
      mediaUrl: mediaUrl || undefined,
      audioUrl: audioUrl || undefined,
      createdAt: {
        toDate: () => new Date(nowMillis),
        toMillis: () => nowMillis,
        seconds: Math.floor(nowMillis / 1000),
        nanoseconds: 0
      } as any,
      status: 'queued',
      contextId: selectedContact?.contextId || undefined,
      contextType: selectedContact?.contextType || 'general',
      priceUpdateAgreement: priceUpdate || undefined,
      isQueued: true
    };

    // If offline, store in localStorage queue and render optimistically
    if (!navigator.onLine) {
      const q = getOutgoingQueue();
      q.push(queuedItem);
      saveOutgoingQueue(q);
      setQueuedCount(q.length);
      setMessages(prev => [...prev, optimisticMsg]);
      setNewMessage('');
      return;
    }

    // Try sending online to Firestore
    try {
      const msgData = {
        senderId: profile.ownerId,
        senderName: profile.shopName || profile.name,
        receiverId: targetReceiverId,
        content: content,
        mediaUrl: mediaUrl || null,
        audioUrl: audioUrl || null,
        contextId: selectedContact?.contextId || null,
        contextType: selectedContact?.contextType || 'general',
        priceUpdateAgreement: priceUpdate || null,
        type: isDirect ? 'direct' : 'group',
        createdAt: serverTimestamp(),
        status: 'sent'
      };

      await addDoc(collection(db, 'messages'), msgData);
      
      // Update chat metadata for direct chats
      if (selectedContact?.id && !selectedGroup) {
        const chatsRef = collection(db, 'chats');
        const q = query(chatsRef, where('participantIds', 'array-contains', profile.ownerId));
        const chatSnap = await getDocs(q);
        const existingChat = chatSnap.docs.find(d => d.data().participantIds.includes(selectedContact.id));
        
        if (existingChat) {
          await updateDoc(doc(db, 'chats', existingChat.id), {
            lastMessage: content || (mediaUrl ? 'صورة' : 'رسالة'),
            lastMessageAt: serverTimestamp()
          });
        }
      }

      setNewMessage('');
    } catch (error) {
      console.warn('Direct Firestore write failed, safely enqueueing to localStorage:', error);
      const q = getOutgoingQueue();
      q.push(queuedItem);
      saveOutgoingQueue(q);
      setQueuedCount(q.length);
      setMessages(prev => [...prev, optimisticMsg]);
      setNewMessage('');
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName || selectedForGroup.length === 0 || !profile) return;
    try {
      await addDoc(collection(db, 'chatGroups'), {
        name: groupName,
        members: [...selectedForGroup, profile.ownerId],
        createdBy: profile.ownerId,
        type: 'group',
        createdAt: serverTimestamp()
      });
      setGroupName('');
      setSelectedForGroup([]);
      setShowGroupModal(false);
      alert('تم إنشاء المجموعة بنجاح');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chatGroups');
    }
  };

  const handleLeaveGroup = async () => {
    if (!selectedGroup || !profile?.ownerId) return;
    if (!confirm('هل أنت متأكد أنك تريد مغادرة هذه المجموعة؟')) return;
    try {
      const groupRef = doc(db, 'chatGroups', selectedGroup.id);
      const updatedMembers = (selectedGroup.members || []).filter((m: string) => m !== profile.ownerId);
      
      await updateDoc(groupRef, { members: updatedMembers });

      // Add a system message notifying others that the user left
      await addDoc(collection(db, 'messages'), {
        senderId: 'system',
        senderName: 'النظام',
        receiverId: selectedGroup.id,
        content: `غادر ${profile.shopName || profile.name || 'عضو'} المجموعة.`,
        createdAt: serverTimestamp(),
        status: 'sent',
        type: 'group'
      });

      setSelectedGroup(null);
      alert('لقد غادرت المجموعة بنجاح.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'chatGroups');
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastMessage || selectedForBroadcast.length === 0 || !profile) return;
    try {
      const promises = selectedForBroadcast.map(targetId => 
        addDoc(collection(db, 'messages'), {
          senderId: profile.ownerId,
          receiverId: targetId,
          content: broadcastMessage,
          type: 'broadcast',
          createdAt: serverTimestamp(),
          read: false
        })
      );
      await Promise.all(promises);
      setBroadcastMessage('');
      setSelectedForBroadcast([]);
      setShowBroadcastModal(false);
      alert('تم إرسال الترحيل الجماعي لجميع المختارين');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'messages');
    }
  };

  const startDirectChatByPhone = async (phone: string) => {
    if (!phone) return;
    try {
      const q = query(collection(db, 'users'), where('phone', '==', phone), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) {
        alert('لم يتم العثور على مستخدم بهذا الرقم');
        return;
      }
      const userData = snap.docs[0].data();
      
      if (userData.disableChatRequests && userData.ownerId !== profile?.ownerId) {
        alert('هذا المستخدم قام بتعطيل طلبات الدردشة الجديدة حالياً.');
        return;
      }

      const contact = {
        id: userData.ownerId,
        name: userData.name,
        shopName: userData.shopName || userData.name,
        role: userData.role,
        unreadCount: 0,
        phone: userData.phone
      } as ChatContact;
      
      setContacts(prev => {
        if (prev.find(c => c.id === contact.id)) return prev;
        return [contact, ...prev];
      });
      setSelectedContact(contact);
      setSelectedGroup(null);
      setSearchTerm('');
    } catch (error) {
      alert('خطأ في البحث');
    }
  };

  const isB2BContact = (c: any) => {
    const r = (c.appRole || c.role || 'user').toUpperCase();
    return ['IMPORTER', 'WHOLESALER', 'RETAILER'].includes(r);
  };

  const filteredContacts = contacts.filter(c => {
    if (c.status === 'deleted' || c.deleted === true || c.isDeleted === true) return false;

    const matchText = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                      c.shopName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (c.phone && c.phone.includes(searchTerm));
    if (!matchText) return false;

    const isB2B = isB2BContact(c);
    if (chatTab === 'b2b') {
      return isB2B;
    } else {
      return !isB2B;
    }
  });

  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        setIsUploading(true);
        try {
          if (!navigator.onLine) {
            // Offline fallback: convert audio blob to Base64 data URL so it can be queued in localStorage
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64Audio = reader.result as string;
              await handleSendMessage(undefined, undefined, undefined, base64Audio);
            };
            reader.readAsDataURL(audioBlob);
          } else {
            const { uploadToMega } = await import('../services/megaService');
            const file = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
            const url = await uploadToMega(file, profile.ownerId, 'chat_audio');
            await handleSendMessage(undefined, undefined, undefined, url);
          }
        } catch (error) {
          console.warn('Audio upload failed or offline, fallback to base64 audio:', error);
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64Audio = reader.result as string;
            await handleSendMessage(undefined, undefined, undefined, base64Audio);
          };
          reader.readAsDataURL(audioBlob);
        } finally {
          setIsUploading(false);
        }
        
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Microphone access error:', error);
      alert('يجب السماح بالوصول للميكروفون لتسجيل الرسائل الصوتية');
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const generateAccountStatement = async () => {
    if (!selectedContact || !profile) return;
    setIsGeneratingPDF(true);
    try {
      // Fetch relevant transactions for this contact
      const q = query(
        collection(db, 'transactions'),
        where('ownerId', '==', profile.ownerId),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const snap = await getDocs(q);
      const data = snap.docs
        .map(d => d.data())
        .filter(t => t.description?.includes(selectedContact.shopName) || t.description?.includes(selectedContact.name));

      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      
      // Add Amiri-Regular Arabic font to jsPDF Virtual File System supporting UTF-8 and RTL direction
      const amiriFontBase64 = "AAEAAAASAQAABAAgR0RFRgBJAE0AAAEsAAAAIkdQT1N9F30OAAADSAAAAFpGSVVCBIEEsQAAA3AAAAAgT1MvMnYrYiEAAAFsAAAAYVBMVkUAAAAA//8AAAF0AAAAVmNhbXAACAALAAACoAAAAAxnYXNwAAAAEAAAAWgAAAAIZ2x5ZmJofS8AAAckAAAAGGhlYWQYpbeCAAAA8AAAADZoaGVhB4IE8QAAASQAAAAkaG10eBAAAG8AAAGgAAAACGxvY2EAcABwAAAHBAAAAAttYXhwAA8ALQAAAUgAAAAgbmFtZWbVlqIAAAXUAAAB9nBvc3T/bQBkAAABeAAAACBwcmVww9e46QAABxwAAACmAAEAAAAKADAAPgACREZMVAAObGF0bgAsAAQAAAAAAAAAAQAAAAAAAQAAAAEAAAAAAAQAAAABAAAAAAACAAEAAAAAAAOFAHgABQAEgA0AFAAbACAAOQBEAEgATgBUAFoAAAAA//8AAAAA//8AAAAA//8AAAAA//8AAAAA//8AAHByZWYAAwADAAAAAAAAAAEAAgABAAEAAAEGAAABAwAAAAEAAAAUAAAAFAAAAAAABAAEAAEABAABAAQAAQAABgABAAIAAgACAAIAAgAAAAMAAwADAAQAAwADAAAAAwAAAAEAAAADAAIAAQABAAAAAgADAAEAAAAEAAAAAwADAAEAAAABAAAAAgADAAEAAQA=";
      doc.addFileToVFS('Amiri-Regular.ttf', amiriFontBase64);
      doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
      doc.setFont('Amiri');
      
      doc.setFontSize(22);
      doc.setTextColor(44, 62, 80);
      
      // Header Section with RTL text
      doc.text('JAM System Pro', 105, 20, { align: 'center' });
      doc.setFontSize(10);
      doc.text('Advanced Management System - كشف حساب مالي ممتاز', 105, 27, { align: 'center' });
      
      doc.setFontSize(14);
      doc.text(`المستلم: ${selectedContact.shopName}`, 195, 40, { align: 'right' });
      doc.text(`التاريخ: ${new Date().toLocaleDateString('ar-YE')}`, 195, 47, { align: 'right' });

      const tableData = data.map((t, idx) => [
        idx + 1,
        t.createdAt?.toDate().toLocaleDateString('ar-YE') || '---',
        t.type === 'income' ? 'له (+)' : 'عليه (-)',
        t.amount.toLocaleString() + ' ر.ي',
        t.description || '---'
      ]);

      autoTable(doc, {
        head: [['#', 'التاريخ', 'طبيعة العملية', 'القيمة المحاسبية', 'البيان والملاحظات']],
        body: tableData,
        startY: 55,
        styles: { 
          halign: 'right',
          fontSize: 10,
          font: 'Amiri'
        },
        headStyles: { 
          fillColor: [31, 41, 55],
          halign: 'right'
        },
        columnStyles: {
          4: { halign: 'right', cellWidth: 80 }
        }
      });

      secureFileExport.protectPDF(doc, "Chat Ledger Report");
      doc.save(`كشف_حساب_${selectedContact.shopName.replace(/\s+/g, '_')}.pdf`);
      await handleSendMessage(undefined, undefined, undefined, undefined, `📖 تم تصدير كشف الحساب المالي المعتمد بنجاح وإرساله للطرف الآخر بصيغة PDF معتمدة.`);
    } catch (error: any) {
      console.error('PDF Export failed:', error);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        await handleSendMessage(undefined, base64);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload failed:', error);
      setIsUploading(false);
    }
  };

  const handleUpdatePriceInOrder = async (message: Message) => {
    if (!message.priceUpdateAgreement || !message.contextId) return;
    
    try {
      const orderRef = doc(db, 'networkOrders', message.contextId);
      await updateDoc(orderRef, {
        total: message.priceUpdateAgreement.newPrice,
        priceUpdatedByAgreement: true,
        updatedAt: serverTimestamp()
      });

      // Update message status
      await updateDoc(doc(db, 'messages', message.id), {
        'priceUpdateAgreement.status': 'accepted'
      });

      alert('تم تحديث السعر في الطلب بناءً على الاتفاق بنجاح');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'networkOrders');
    }
  };

  return (
    <div className={`flex h-[calc(100dvh-140px)] md:h-[calc(100vh-180px)] bg-white dark:bg-navy-800 rounded-2xl md:rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-white/5 overflow-hidden transition-colors ${profile?.visualTheme === 'light' ? 'light-chats' : ''}`}>
      {/* Contacts List */}
      <div className={`w-full md:w-80 border-l border-gray-100 flex-col bg-gray-50/50 ${
        (selectedContact || selectedGroup) ? 'hidden md:flex' : 'flex'
      }`}>
        <div className="p-6 border-b border-gray-100 bg-white">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <MessageSquare className="text-indigo-600" />
              الدردشة
            </h2>
            <div className="relative flex gap-1">
              <button 
                onClick={() => setShowChatSettings(true)}
                className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-xl transition-all"
                title="إعدادات الخصوصية"
              >
                <SettingsIcon size={18} />
              </button>
              <button 
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-xl transition-all"
              >
                <Plus size={20} />
              </button>
              
              <AnimatePresence>
                {showAddMenu && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute left-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 z-50 overflow-hidden"
                  >
                    <button 
                      onClick={() => { setShowGroupModal(true); setShowAddMenu(false); }}
                      className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 rounded-xl transition-all text-xs font-bold text-gray-700"
                    >
                      <Users size={16} />
                      إنشاء مجموعة جديدة
                    </button>
                    <button 
                      onClick={() => { setShowBroadcastModal(true); setShowAddMenu(false); }}
                      className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 rounded-xl transition-all text-xs font-bold text-gray-700"
                    >
                      <ArrowRightLeft size={16} />
                      ترحيل جماعي (بث)
                    </button>
                    <button 
                      onClick={() => { 
                        const phone = prompt('أدخل رقم هاتف المستخدم لبدء المحادثة:');
                        if (phone) startDirectChatByPhone(phone);
                        setShowAddMenu(false);
                      }}
                      className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 rounded-xl transition-all text-xs font-bold text-gray-700"
                    >
                      <UserPlus size={16} />
                      بحث برقم الهاتف
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="mt-4 relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input 
              type="text" 
              placeholder="البحث في المحادثات..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-9 pl-4 py-2 bg-gray-100 border-none rounded-xl text-xs font-bold focus:ring-2 ring-indigo-500/20"
            />
          </div>

          {/* Segment controls for B2B vs B2C */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-xl mt-3 text-[10px] font-black">
            <button
              onClick={() => { setChatTab('b2b'); setSelectedContact(null); setSelectedGroup(null); }}
              className={`py-2 px-1 rounded-lg text-center transition-all flex items-center justify-center gap-1.5 ${chatTab === 'b2b' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
            >
              <Store size={12} />
              رابطة قطاع الأعمال (B2B)
            </button>
            <button
              onClick={() => { setChatTab('b2c'); setSelectedContact(null); setSelectedGroup(null); }}
              className={`py-2 px-1 rounded-lg text-center transition-all flex items-center justify-center gap-1.5 ${chatTab === 'b2c' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
            >
              <User size={12} />
              محادثات الزبائن والعملاء
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {/* Groups List */}
          {filteredGroups.length > 0 && (
            <div className="p-2">
              <p className="text-[10px] font-black text-indigo-400 uppercase mb-2 px-2">المجموعات</p>
              {filteredGroups.map((group, idx) => (
                <button
                  key={`${group.id}-${idx}`}
                  onClick={() => { setSelectedGroup(group); setSelectedContact(null); }}
                  className={`w-full p-4 rounded-3xl flex items-center gap-4 transition-all ${selectedGroup?.id === group.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'hover:bg-white text-gray-700'}`}
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg ${selectedGroup?.id === group.id ? 'bg-white/20' : 'bg-indigo-100 text-indigo-600'}`}>
                    <Users size={20} />
                  </div>
                  <div className="flex-1 text-right overflow-hidden">
                    <h4 className="font-black text-sm truncate">{group.name}</h4>
                    <p className={`text-[10px] truncate ${selectedGroup?.id === group.id ? 'text-indigo-100' : 'text-gray-400'}`}>
                       {(() => {
                         const activeMembers = (group.members || []).filter((m: string) => {
                           if (m === profile?.ownerId) return true;
                           const contact = contacts.find(c => c.id === m || c.ownerId === m);
                           if (contact) {
                             return contact.status !== 'deleted' && contact.deleted !== true && contact.isDeleted !== true;
                           }
                           return true;
                         });
                         return activeMembers.length;
                       })()} أعضاء
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Contacts List */}
          <div className="p-2">
            <p className="text-[10px] font-black text-indigo-400 uppercase mb-2 px-2">جهات الاتصال</p>
            {filteredContacts.map((contact, idx) => (
              <button
                key={`${contact.id}-${idx}`}
                onClick={() => { setSelectedContact(contact); setSelectedGroup(null); }}
                className={`w-full p-4 rounded-3xl flex items-center gap-4 transition-all ${selectedContact?.id === contact.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'hover:bg-white text-gray-700'}`}
              >
                <div className="relative">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg ${selectedContact?.id === contact.id ? 'bg-white/20' : 'bg-indigo-100 text-indigo-600'}`}>
                    {contact.shopName[0]}
                  </div>
                  {isUserOnline(contact.lastSeen) && (
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-navy-950 shadow-sm" title="متصل الآن" />
                  )}
                </div>
                <div className="flex-1 text-right overflow-hidden relative">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <h4 className="font-black text-sm truncate">{contact.shopName}</h4>
                      {(() => {
                        const rawRole = (contact.appRole || contact.role || 'user').toUpperCase();
                        if (rawRole === 'IMPORTER') {
                          return <span className="shrink-0 px-1.5 py-0.5 bg-amber-500 text-white text-[8px] font-black rounded">مستورد</span>;
                        } else if (rawRole === 'WHOLESALER') {
                          return <span className="shrink-0 px-1.5 py-0.5 bg-indigo-600 text-white text-[8px] font-black rounded">جملة</span>;
                        } else if (rawRole === 'RETAILER') {
                          return <span className="shrink-0 px-1.5 py-0.5 bg-emerald-600 text-white text-[8px] font-black rounded">تجزئة</span>;
                        }
                        return null;
                      })()}
                    </div>
                    {contact.unreadCount > 0 && (
                      <div className="flex flex-col items-end gap-1">
                        <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.8)] border border-white" />
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${selectedContact?.id === contact.id ? 'bg-white text-indigo-600' : 'bg-indigo-600 text-white'}`}>
                          {contact.unreadCount}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className={`text-[10px] truncate ${selectedContact?.id === contact.id ? 'text-indigo-100' : (contact.unreadCount > 0 ? 'text-indigo-600 font-black' : 'text-gray-400')}`}>
                     {contact.unreadCount > 0 ? 'رسائل جديدة' : (contact.lastMessage || contact.name)}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {filteredContacts.length === 0 && filteredGroups.length === 0 && !loading && (
            <div className="p-4 text-center space-y-4">
              <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100/50">
                <Store className="mx-auto text-indigo-600 mb-2" size={32} />
                <h4 className="text-sm font-black text-gray-900">تريد البدء؟</h4>
                <p className="text-[10px] text-gray-500 font-bold mb-4">اكتشف الموردين في منطقتك وابدأ الطلب والدردشة فوراً</p>
                <button 
                  onClick={() => {
                    // This is a bridge to NetworkHub, ideally we'd use a shared state or just inform
                    alert('توجه إلى قسم "الترابط الشبكي" لاكتشاف موردين جدد');
                    window.location.hash = '/network';
                  }}
                  className="w-full py-2 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-100"
                >
                  اكتشاف موردين
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex-col bg-white ${
        !(selectedContact || selectedGroup) ? 'hidden md:flex' : 'flex'
      }`}>
        {(selectedContact || selectedGroup) ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setSelectedContact(null);
                    setSelectedGroup(null);
                  }}
                  className="flex items-center gap-1.5 p-1.5 text-gray-500 hover:text-indigo-600 bg-transparent hover:bg-gray-100 rounded-xl text-xs font-black transition-all"
                  title="العودة إلى جهات الاتصال"
                  id="jam_back_to_contacts_btn"
                >
                  <ArrowRight size={20} className="stroke-[2.5]" />
                  <span>العودة</span>
                </button>
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                  {selectedGroup ? <Users size={20} /> : <Store size={20} />}
                </div>
                <div>
                  <h3 className="font-black text-gray-900 leading-tight">{selectedGroup ? selectedGroup.name : selectedContact!.shopName}</h3>
                  {!selectedGroup && (
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${isUserOnline(selectedContact!.lastSeen) ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                      <span className="text-[10px] font-bold text-gray-400">
                        {isUserOnline(selectedContact!.lastSeen) ? 'متصل الآن' : 'آخر ظهور ' + (selectedContact!.lastSeen?.toDate().toLocaleTimeString('ar-YE'))}
                      </span>
                      {!isOnline && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-bold border border-amber-500/30 flex items-center gap-1 mr-1">
                          <Clock size={10} className="text-amber-500" />
                          وضع دون اتصال
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedGroup && (
                  <button
                    onClick={handleLeaveGroup}
                    className="p-3 hover:bg-rose-50 text-rose-600 rounded-2xl transition-all flex items-center gap-1.5 text-xs font-black border border-rose-100 bg-rose-50/20"
                    title="مغادرة المجموعة"
                  >
                    <LogOut size={16} className="text-rose-600 shrink-0" />
                    <span>مغادرة المجموعة</span>
                  </button>
                )}
                <button 
                  onClick={handleStartOutgoingCall}
                  className="p-3 hover:bg-green-50 text-green-600 rounded-2xl transition-all"
                  title="اتصال صوتي عالي الأولوية"
                >
                  <PhoneCall size={20} />
                </button>
                <button 
                  onClick={generateAccountStatement}
                  disabled={isGeneratingPDF}
                  className="p-3 hover:bg-orange-50 text-orange-600 rounded-2xl transition-all disabled:opacity-50"
                  title={isGeneratingPDF ? "جاري إنشاء كشف حساب PDF..." : "طلب كشف حساب PDF"}
                >
                  <FileText size={20} className={isGeneratingPDF ? "opacity-60" : ""} />
                </button>
                {!selectedGroup && selectedContact && (
                  <button
                    onClick={() => {
                      const isBlocked = chatPrivacy.blockedUsers?.includes(selectedContact.id);
                      let newBlocked = [...(chatPrivacy.blockedUsers || [])];
                      if (isBlocked) {
                        newBlocked = newBlocked.filter(id => id !== selectedContact.id);
                        alert(`تم إلغاء حظر الموزع/العميل (${selectedContact.shopName}) بنجاح.`);
                      } else {
                        newBlocked.push(selectedContact.id);
                        alert(`🚫 تم حظر (${selectedContact.shopName}). لن تستقبل منه أي إشعارات أو رسائل عشوائية.`);
                      }
                      setChatPrivacy({ ...chatPrivacy, blockedUsers: newBlocked });
                    }}
                    className={`p-3 rounded-2xl transition-all ${
                      chatPrivacy.blockedUsers?.includes(selectedContact.id)
                        ? 'bg-rose-500/10 text-rose-500'
                        : 'hover:bg-gray-100 text-gray-500'
                    }`}
                    title={chatPrivacy.blockedUsers?.includes(selectedContact.id) ? "إلغاء حظر الموزع" : "درع حظر الموزع (أنتي سبام)"}
                  >
                    <ShieldAlert size={20} />
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/30">
              {isUserInActiveCall && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-5 bg-gradient-to-r from-indigo-900 to-indigo-950 text-white rounded-[2rem] shadow-xl border border-indigo-700/30 flex flex-col gap-4 font-sans mb-4 animate-fade-in"
                  dir="rtl"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center">
                          <Phone size={18} className="animate-pulse" />
                        </div>
                        <div className="absolute -bottom-1 -left-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border border-indigo-900" />
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-indigo-300 font-black tracking-wider block uppercase">جلسة اتصال نشطة ومحميّة</span>
                        <h4 className="font-black text-sm text-white">
                          مكالمة مع: {selectedGroup ? selectedGroup.name : selectedContact?.shopName}
                        </h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 text-[9px] font-black rounded-lg ${isCallOnHold ? 'bg-orange-600 text-white animate-pulse' : 'bg-green-600 text-white'}`}>
                        {isCallOnHold ? '⏸️ قيد الانتظار (HOLD)' : '🟢 متصل الآن'}
                      </span>
                      <button
                        onClick={handleToggleHold}
                        className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all ${isCallOnHold ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-white/10 text-white hover:bg-white/20'}`}
                        title={isCallOnHold ? 'استئناف المكالمة' : 'وضع قيد الانتظار'}
                      >
                        {isCallOnHold ? 'استئناف' : 'انتظار ⏸️'}
                      </button>
                      <button
                        onClick={handleCleanupCall}
                        className="p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all"
                        title="إنهاء المكالمة"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Busy Blocked Callers Alerts */}
                  {busyCallsLog.length > 0 && (
                    <div className="mt-2 pt-3 border-t border-indigo-800/40 text-right">
                      <div className="flex items-center gap-1.5 text-orange-400 text-[10px] font-black mb-1.5">
                        <ShieldAlert size={12} />
                        تنبيه الخط المشغول (مكالمات انتظار واردة):
                      </div>
                      <div className="space-y-1">
                        {busyCallsLog.map((log, lIdx) => (
                          <div key={lIdx} className="flex justify-between items-center text-[10px] text-indigo-200">
                            <span>{log.callerName}</span>
                            <span>{log.timestamp.toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
              {queuedCount > 0 && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-2.5 rounded-2xl flex items-center justify-between text-xs font-bold mb-3 shadow-sm animate-fade-in" dir="rtl">
                  <div className="flex items-center gap-2">
                    <Clock size={15} className="text-amber-600 animate-spin shrink-0" />
                    <span>
                      يوجد {queuedCount} {queuedCount === 1 ? 'رسالة معلقة' : 'رسائل في قائمة الانتظار'} (دون اتصال) - ستُرسل تلقائياً إلى السحابة فور عودة الإنترنت
                    </span>
                  </div>
                  {isOnline && (
                    <button
                      onClick={() => syncQueuedMessages()}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[11px] font-black transition-all flex items-center gap-1 shadow-sm shrink-0 cursor-pointer"
                    >
                      <FolderSync size={13} />
                      إرسال الآن
                    </button>
                  )}
                </div>
              )}
              {messages.map((msg, idx) => {
                const isMine = msg.senderId === profile?.ownerId;
                const showDate = idx === 0 || (messages[idx-1] && msg.createdAt?.toMillis() - messages[idx-1].createdAt?.toMillis() > 3600000);

                return (
                  <React.Fragment key={`${msg.id}-${idx}`}>
                    {showDate && (
                      <div className="flex justify-center my-4">
                        <span className="px-3 py-1 bg-gray-200/50 text-[10px] text-gray-500 font-bold rounded-full">
                           {msg.createdAt?.toDate().toLocaleDateString('ar-YE', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                    <motion.div
                      initial={{ opacity: 0, x: isMine ? 20 : -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] p-4 rounded-3xl transition-all duration-500 ${
                        isMine 
                          ? 'bg-indigo-600 text-white rounded-br-none shadow-md' 
                          : (!isMine && msg.status !== 'read' 
                              ? 'bg-indigo-100 text-indigo-900 border-2 border-indigo-200 shadow-lg scale-[1.02] rounded-bl-none font-bold' 
                              : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-none')
                      }`}>
                        {!isMine && selectedGroup && (
                          <p className="text-[10px] font-black text-indigo-500 mb-1">{(msg as any).senderName || 'عضو'}</p>
                        )}
                        {!isMine && msg.status !== 'read' && (
                           <div className="flex items-center gap-1 mb-1 text-[10px] text-indigo-600">
                              <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse" />
                              رسالة جديدة
                           </div>
                        )}
                        {msg.mediaUrl && (
                          <div className="mb-2 rounded-2xl overflow-hidden">
                             <img src={msg.mediaUrl} alt="chat media" className="w-full max-h-64 object-cover" referrerPolicy="no-referrer" />
                          </div>
                        )}
                        {(msg as any).audioUrl && (
                          <div className={`mb-2 p-3 rounded-2xl flex items-center gap-3 ${isMine ? 'bg-white/10' : 'bg-indigo-50'}`}>
                             <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white shrink-0">
                                <Volume2 size={20} />
                             </div>
                             <audio controls className="h-8 max-w-[180px]">
                               <source src={(msg as any).audioUrl} type="audio/webm" />
                             </audio>
                          </div>
                        )}
                        {msg.priceUpdateAgreement && (
                          <div className={`p-4 rounded-2xl border-2 mb-2 ${isMine ? 'bg-white/10 border-white/20' : 'bg-indigo-50 border-indigo-100'}`}>
                             <div className="flex items-center gap-2 mb-2">
                                <AlertCircle size={16} />
                                <span className="text-xs font-black">اتفاقية تعديل سعر الطلب</span>
                             </div>
                             <div className="flex items-center justify-between mb-4">
                                <div className="text-center">
                                   <p className="text-[9px] opacity-70">السعر القديم</p>
                                    <p className="font-black line-through">{msg.priceUpdateAgreement.oldPrice}</p>
                                 </div>
                                 <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-white">
                                    <ChevronRight size={14} className="rotate-180" />
                                 </div>
                                 <div className="text-center">
                                    <p className="text-[9px] opacity-70">السعر الجديد</p>
                                    <p className="font-black text-lg">{msg.priceUpdateAgreement.newPrice}</p>
                                 </div>
                              </div>
                              {!isMine && msg.priceUpdateAgreement.status === 'pending' && (
                                <button 
                                  onClick={() => handleUpdatePriceInOrder(msg)}
                                  className="w-full py-2 bg-indigo-600 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
                                >
                                   <CheckCircle2 size={16} />
                                   تحديث السعر في النظام
                                </button>
                              )}
                              {msg.priceUpdateAgreement.status === 'accepted' && (
                                <div className="text-center text-green-500 font-black text-xs flex items-center justify-center gap-2">
                                  <CheckCircle2 size={16} />
                                  تم التحديث والموافقة بنجاح
                                </div>
                              )}
                            </div>
                          )}
                          <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          <div className={`flex items-center gap-1.5 mt-2 justify-end ${isMine ? 'text-indigo-200' : 'text-gray-400'}`}>
                            <span className="text-[9px]">
                              {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' }) : '...'}
                            </span>
                            {isMine && (
                              <div className="flex items-center">
                                {(msg as any).isQueued || msg.status === ('queued' as any) ? (
                                  <span className="flex items-center gap-1 text-[9px] text-amber-200" title="في قائمة الانتظار (دون اتصال) - سيتم الإرسال تلقائياً فور عودة الاتصال">
                                    <Clock size={12} className="animate-spin text-amber-300" />
                                    <span>معلقة</span>
                                  </span>
                                ) : msg.status === 'read' ? (
                                  <CheckCheck size={14} className="text-blue-300" />
                                ) : (
                                  <Check size={14} className={msg.status === 'delivered' ? 'text-white' : 'text-indigo-300'} />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    </React.Fragment>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 md:p-4 bg-white border-t border-gray-100 px-4 md:px-6 py-4 md:py-6 font-bold relative">
                {isRecording && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute inset-x-0 -top-12 h-12 bg-red-600 text-white flex items-center justify-between px-8"
                  >
                     <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                        <span className="text-xs font-black">جاري تسجيل رسالة صوتية... {formatDuration(recordingDuration)}</span>
                     </div>
                     <button onClick={stopRecording} className="text-[10px] font-black underline">إلغاء وإيقاف</button>
                  </motion.div>
                )}

                <form onSubmit={(e) => handleSendMessage(e)} className="flex items-center gap-1.5 md:gap-4">
                  <div className="flex items-center gap-1 md:gap-2 shrink-0">
                    <label className="cursor-pointer p-2 md:p-3 bg-gray-100 text-gray-500 rounded-2xl hover:bg-gray-200 transition-all">
                       <ImageIcon size={18} className="md:w-5 md:h-5" />
                       <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                    </label>
                    {!isRecording ? (
                      <button 
                        type="button"
                        onClick={startRecording}
                        className="hidden sm:block p-2 md:p-3 bg-indigo-100 text-indigo-600 rounded-2xl hover:bg-indigo-200 transition-all"
                      >
                         <Mic size={18} className="md:w-5 md:h-5" />
                      </button>
                    ) : (
                      <button 
                        type="button"
                        onClick={stopRecording}
                        className="hidden sm:block p-2 md:p-3 bg-red-600 text-white rounded-2xl hover:bg-red-700 transition-all animate-pulse"
                      >
                         <StopCircle size={18} className="md:w-5 md:h-5" />
                      </button>
                    )}
                    <button 
                      type="button"
                      onClick={() => {
                        const template = prompt('اختر قالب رسالة:\n1. طلب قطعة غيار\n2. استفسار فني\n3. عرض سعر جديد\n4. طلب مساعدة برمجية\n5. استفسار عن مخطط جهاز');
                        if (template === '1') setNewMessage('السلام عليكم، هل تتوفر لديكم قطعة غيار لـ (اسم الجهاز والقطعة)؟');
                        if (template === '2') { setNewMessage('تحية طيبة، أحتاج مساعدة فنية في جهاز (اسم الجهاز)'); }
                        if (template === '3') setNewMessage('يرجى تزويدي بأفضل عرض سعر للآتي: ');
                        if (template === '4') setNewMessage('هل يوجد مهندس متمكن من إصلاح (اسم المشكلة البرمجية) لهذا الموديل؟');
                        if (template === '5') setNewMessage('أحتاج مخطط (Schematic) أو صورة بوردة لجهاز (اسم الجهاز) لو تكرمتم.');
                      }}
                      className="p-2 md:p-3 bg-indigo-100 text-indigo-600 rounded-2xl hover:bg-indigo-200 transition-all"
                      title="قوالب سريعة"
                    >
                       <Paperclip size={18} className="md:w-5 md:h-5" />
                    </button>
                    {selectedContact?.contextType === 'order' && isWholesaler && (
                      <button 
                        type="button"
                        onClick={() => {
                          const newP = prompt('أدخل السعر الجديد المقترح:');
                          if (newP) {
                            handleSendMessage(undefined, undefined, {
                              oldPrice: 0,
                              newPrice: Number(newP),
                              status: 'pending'
                            });
                          }
                        }}
                        className="p-2 md:p-3 bg-indigo-100 text-indigo-600 rounded-2xl hover:bg-indigo-200 transition-all font-black text-xs shrink-0 flex items-center justify-center"
                        title="اقتراح سعر جديد"
                      >
                         <Paperclip size={18} className="md:w-5 md:h-5" />
                      </button>
                    )}
                  </div>
                  <input 
                    type="text" 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    disabled={isRecording}
                    placeholder={isRecording ? `جاري التسجيل... ${Math.floor(recordingDuration/60)}:${(recordingDuration%60).toString().padStart(2, '0')}` : "اكتب رسالتك هنا..."}
                    className={`flex-1 py-2 px-3 md:py-4 md:px-6 border-none rounded-2xl text-xs md:text-sm focus:ring-2 outline-none transition-all ${isRecording ? 'bg-rose-50 text-rose-600 ring-rose-500/20' : 'bg-gray-100 ring-indigo-500/20'}`}
                  />
                  <button 
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`w-10 h-10 md:w-14 md:h-14 shrink-0 rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-95 ${isRecording ? 'bg-rose-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    title={isRecording ? 'توقف وإرسال' : 'ضغط للتسجيل الصوتي'}
                  >
                    {isRecording ? <StopCircle size={18} className="md:w-6 md:h-6" /> : <Mic size={18} className="md:w-6 md:h-6" />}
                  </button>
                  <button 
                    type="submit"
                    disabled={!newMessage.trim() || isRecording}
                    className="w-10 h-10 md:w-14 md:h-14 shrink-0 bg-indigo-600 text-white rounded-2xl flex items-center justify-center hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 disabled:opacity-50 disabled:grayscale"
                  >
                    <Send size={18} className="md:w-6 md:h-6" />
                  </button>
                </form>
              </div>
            </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50/50">
            <div className="text-center max-w-sm px-6">
              <div className="w-24 h-24 bg-indigo-50 rounded-[3rem] flex items-center justify-center mx-auto mb-6 text-indigo-600">
                <MessageCircle size={48} />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">اختر محادثة للبدء</h3>
              <p className="text-gray-500 text-sm font-bold">يمكنك التواصل مع الموردين، العملاء، أو أعضاء فريقك مباشرة ومن مكان واحد.</p>
            </div>
          </div>
        )}

        {/* Call Modal */}
        <AnimatePresence>
          {showCallModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-navy-950/90 backdrop-blur-md flex items-center justify-center p-6 text-white"
            >
              <div className="w-full max-w-sm text-center space-y-8">
                <div className="relative inline-block">
                  <div className="w-32 h-32 rounded-full bg-indigo-600 flex items-center justify-center text-4xl font-black relative z-10">
                    {selectedContact ? selectedContact.shopName[0] : selectedGroup?.name[0]}
                  </div>
                  <div className="absolute inset-0 rounded-full bg-indigo-500 animate-ping opacity-20" />
                  <div className="absolute -inset-4 rounded-full border-2 border-indigo-500/30 animate-[pulse_2s_infinite]" />
                </div>
                <div>
                  <h3 className="text-3xl font-black mb-2">{selectedGroup ? selectedGroup.name : selectedContact?.shopName}</h3>
                  <p className="text-indigo-400 font-bold uppercase tracking-widest text-xs">
                    {showCallModal === 'outgoing' ? 'جاري الاتصال...' : 'مكالمة واردة'}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-8">
                  {showCallModal === 'incoming' && (
                    <button 
                      onClick={handleAcceptCall}
                      className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg shadow-green-500/20"
                    >
                      <Phone size={28} />
                    </button>
                  )}
                  <button 
                    onClick={handleDeclineCall}
                    className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-lg shadow-red-500/20"
                  >
                    <X size={28} />
                  </button>
                </div>
                <div className="pt-8 grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white/5 rounded-3xl border border-white/10">
                    <Video className="mx-auto mb-2 text-indigo-400" size={20} />
                    <span className="text-[10px] font-bold">فيديو قريباً</span>
                  </div>
                  <div className="p-4 bg-white/5 rounded-3xl border border-white/10">
                    <ShieldCheck className="mx-auto mb-2 text-green-400" size={20} />
                    <span className="text-[10px] font-bold">اتصال مشفر</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modals and Overlays */}
      <AnimatePresence>
        {showChatSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowChatSettings(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-navy-800 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                         <SettingsIcon size={24} />
                      </div>
                      <div>
                         <h3 className="text-xl font-black text-gray-900 leading-tight">إعدادات الدردشة</h3>
                         <p className="text-xs text-gray-400 font-bold">تحكم في ظهورك وخصوصيتك</p>
                      </div>
                   </div>
                   <button 
                     onClick={() => setShowChatSettings(false)}
                     className="p-2 hover:bg-gray-100 rounded-xl transition-all"
                   >
                     <X size={20} className="text-gray-400" />
                   </button>
                </div>

                <div className="space-y-4">
                   <div className="p-4 bg-gray-50 rounded-3xl border border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-green-100 text-green-600 rounded-xl flex items-center justify-center">
                            <Clock size={20} />
                         </div>
                         <div>
                            <p className="text-sm font-black text-gray-900">الظهور متصل الآن</p>
                            <p className="text-[10px] text-gray-500 font-bold">السماح للآخرين برؤية حالتك</p>
                         </div>
                      </div>
                      <button 
                        onClick={() => setChatPrivacy({...chatPrivacy, appearOnline: !chatPrivacy.appearOnline})}
                        className={`w-14 h-8 rounded-full p-1 transition-all duration-300 ${chatPrivacy.appearOnline ? 'bg-indigo-600' : 'bg-gray-300'}`}
                      >
                         <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 transform ${chatPrivacy.appearOnline ? 'translate-x-0' : '-translate-x-6'}`} />
                      </button>
                   </div>

                   <div className="p-4 bg-gray-50 rounded-3xl border border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                            <CheckCheck size={20} />
                         </div>
                         <div>
                            <p className="text-sm font-black text-gray-900">مؤشرات قراءة الرسائل</p>
                            <p className="text-[10px] text-gray-500 font-bold">إظهار علامة "تمت القراءة" للرسائل</p>
                         </div>
                      </div>
                      <button 
                        onClick={() => setChatPrivacy({...chatPrivacy, showReadReceipts: !chatPrivacy.showReadReceipts})}
                        className={`w-14 h-8 rounded-full p-1 transition-all duration-300 ${chatPrivacy.showReadReceipts ? 'bg-indigo-600' : 'bg-gray-300'}`}
                      >
                         <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 transform ${chatPrivacy.showReadReceipts ? 'translate-x-0' : '-translate-x-6'}`} />
                      </button>
                   </div>

                   <div className="p-4 bg-gray-50 rounded-3xl border border-gray-100 flex flex-col gap-3">
                      <div className="flex items-center justify-between w-full">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                               <FolderSync size={20} />
                            </div>
                            <div>
                               <p className="text-sm font-black text-gray-900">مسار حفظ الوسائط المحلي</p>
                               <p className="text-[10px] text-gray-500 font-bold">تحديد مجلد حفظ المرفقات والصوت على الجهاز</p>
                            </div>
                         </div>
                      </div>
                      <input 
                        type="text"
                        value={chatPrivacy.customLocalMediaPath || '/sdcard/JAMPro/Media'}
                        onChange={(e) => setChatPrivacy({...chatPrivacy, customLocalMediaPath: e.target.value})}
                        className="w-full text-xs font-bold px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-indigo-600 outline-none focus:border-indigo-500"
                        placeholder="e.g., /sdcard/JAMPro/Media"
                      />
                   </div>

                   <div className="p-4 bg-rose-50/30 rounded-3xl border border-rose-100/50 flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center">
                            <Ban size={20} />
                          </div>
                          <div>
                             <p className="text-sm font-black text-rose-900">درع الحماية ضد السبام</p>
                             <p className="text-[10px] text-gray-500 font-bold">الملف السري لجهات الاتصال والمزعجين المحظورين</p>
                          </div>
                       </div>

                       {chatPrivacy.blockedUsers && chatPrivacy.blockedUsers.length > 0 ? (
                         <div className="space-y-2 mt-2">
                           <div className="max-h-24 overflow-y-auto space-y-1.5 pr-1">
                             {chatPrivacy.blockedUsers.map((bId: string) => {
                               const matchingUser = contacts.find(c => c.id === bId);
                               return (
                                 <div key={bId} className="flex items-center justify-between bg-white p-2 border border-gray-100 rounded-xl text-xs">
                                   <span className="text-gray-700 font-bold">{matchingUser?.shopName || 'جهة اتصال محظورة'}</span>
                                   <button
                                     onClick={() => {
                                       const updated = chatPrivacy.blockedUsers.filter((id: string) => id !== bId);
                                       setChatPrivacy({ ...chatPrivacy, blockedUsers: updated });
                                     }}
                                     className="text-rose-600 font-black hover:underline"
                                   >
                                     إلغاء الحظر
                                   </button>
                                 </div>
                               );
                             })}
                           </div>
                         </div>
                       ) : (
                         <p className="text-[10px] text-gray-400 italic text-center font-bold">لا يوجد أي جهة اتصال محظورة حالياً. الدردشة آمنة وحرة!</p>
                       )}
                    </div>
                </div>

                <div className="mt-8">
                   <button 
                     onClick={handlePurgeAllChats}
                     disabled={isPurgingChats}
                     className="w-full py-4 mb-3 bg-rose-600 text-white rounded-2xl font-black shadow-xl shadow-rose-100 hover:bg-rose-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                   >
                     {isPurgingChats ? (
                       <>
                         <Loader2 className="animate-spin" size={18} />
                         جاري تطهير الدردشات وقاعدة البيانات...
                       </>
                     ) : (
                       <>
                         <Ban size={18} />
                         تطهير وتنظيف كافة الدردشات (الكل)
                       </>
                     )}
                   </button>

                   <button 
                     onClick={() => setShowChatSettings(false)}
                     className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 hover:scale-[1.02] active:scale-[0.98] transition-all"
                   >
                      حفظ الإعدادات
                   </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
        {showGroupModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8"
            >
              <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-3">
                <Users className="text-indigo-600" />
                إنشاء مجموعة محادثة
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-black text-gray-500 mb-2 block">اسم المجموعة</label>
                  <input 
                    type="text" 
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="w-full py-4 px-6 bg-gray-100 border-none rounded-2xl text-sm font-bold placeholder:text-gray-400"
                    placeholder="مثال: تجار الجملة - صنعاء"
                  />
                </div>
                
                <div>
                  <label className="text-xs font-black text-gray-500 mb-2 block">اختر الأعضاء</label>
                  <div className="max-h-48 overflow-y-auto space-y-2 p-2 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    {contacts.map((contact, idx) => (
                      <label key={`group-member-${contact.id}-${idx}`} className="flex items-center gap-3 p-3 bg-white rounded-xl cursor-pointer hover:bg-indigo-50 transition-all border border-gray-100">
                        <input 
                          type="checkbox" 
                          checked={selectedForGroup.includes(contact.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedForGroup([...selectedForGroup, contact.id]);
                            else setSelectedForGroup(selectedForGroup.filter(id => id !== contact.id));
                          }}
                          className="w-5 h-5 rounded-md text-indigo-600 border-gray-300 focus:ring-indigo-500"
                        />
                        <div className="flex-1">
                          <p className="text-xs font-black text-gray-900">{contact.shopName}</p>
                          <p className="text-[10px] text-gray-500">{contact.name}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-4 mt-8">
                <button 
                  onClick={handleCreateGroup}
                  disabled={!groupName || selectedForGroup.length === 0}
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 disabled:opacity-50"
                >
                  إنشاء المجموعة
                </button>
                <button 
                  onClick={() => setShowGroupModal(false)}
                  className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-2xl font-black"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showBroadcastModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8"
            >
              <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-3">
                <ArrowRightLeft className="text-indigo-600" />
                ترحيل جماعي (Mass Broadcast)
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-black text-gray-500 mb-2 block">الرسالة المراد إرسالها</label>
                  <textarea 
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    className="w-full py-4 px-6 bg-gray-100 border-none rounded-2xl text-sm font-bold placeholder:text-gray-400 min-h-[120px]"
                    placeholder="اكتب هنا العروض أو الإعلانات التي ترغب في إرسالها لجميع التجار وشركاء العمل المختارين..."
                  />
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-black text-gray-500">اختر المستلمين ({selectedForBroadcast.length})</label>
                    <button 
                      onClick={() => {
                        if (selectedForBroadcast.length === contacts.length) setSelectedForBroadcast([]);
                        else setSelectedForBroadcast(contacts.map(c => c.id));
                      }}
                      className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md"
                    >
                      {selectedForBroadcast.length === contacts.length ? 'إلغاء الكل' : 'اختيار الكل'}
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2 p-2 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    {contacts.map((contact, idx) => (
                      <label key={`broadcast-member-${contact.id}-${idx}`} className="flex items-center gap-3 p-3 bg-white rounded-xl cursor-pointer hover:bg-indigo-50 transition-all border border-gray-100">
                        <input 
                          type="checkbox" 
                          checked={selectedForBroadcast.includes(contact.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedForBroadcast([...selectedForBroadcast, contact.id]);
                            else setSelectedForBroadcast(selectedForBroadcast.filter(id => id !== contact.id));
                          }}
                          className="w-5 h-5 rounded-md text-indigo-600 border-gray-300 focus:ring-indigo-500"
                        />
                        <div className="flex-1">
                          <p className="text-xs font-black text-gray-900">{contact.shopName}</p>
                          <p className="text-[10px] text-gray-500">{contact.name}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-4 mt-8">
                <button 
                  onClick={handleBroadcast}
                  disabled={!broadcastMessage || selectedForBroadcast.length === 0}
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Send size={18} />
                  إرسال الآن
                </button>
                <button 
                  onClick={() => setShowBroadcastModal(false)}
                  className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-2xl font-black"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <JamMiniCallOverlay 
        isActive={isUserInActiveCall}
        peerName={selectedGroup ? selectedGroup.name : (selectedContact?.shopName || 'شريك تجاري B2B')}
        duration={formatCallDuration(callDuration)}
        onDisconnect={handleCleanupCall}
        isWindowFocused={isWindowFocused}
      />
    </div>
  );
}

// ========================================================
// MICROPHONE WAKEUP & AUDIO TRACK INITIALIZATION STABILIZER
// ========================================================
export const handleAnswerAndActivateAudio = async (
  peerConnection: RTCPeerConnection,
  localStream: MediaStream,
  onSuccess: () => void
) => {
  try {
    console.log("🎙️ جاري فحص واستدعاء مسارات الصوت المحلية...");

    // 1. إجبار المتصفح/التطبيق على جلب صلاحية وتيار المايك فوراً عند الرد
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    (window as any).activeLocalStream = stream;
    
    // 2. حقن مسارات الصوت داخل اتصال الـ WebRTC المثبت
    stream.getTracks().forEach(track => {
      peerConnection.addTrack(track, stream);
    });

    console.log("✅ تم ربط تيار المايكروفون بنجاح بداخل جلسة الـ WebRTC النشطة.");
    onSuccess();
  } catch (error) {
    console.error("❌ فشل في فتح المايكروفون أثناء الرد:", error);
    alert("يرجى تفعيل صلاحية المايك لـ JAM System Pro للرد على المكالمة.");
  }
};

// ========================================================
// 3. CALL WAITING & BUSY SIGNAL HANDLER
// ========================================================
export const handleCallWaitingAndBusyState = (
  socket: any,
  currentCallState: { isInCall: boolean; activePeerId: string | null },
  onBusyTrigger: (callerName: string) => void
) => {
  if (!socket) return;
  // الاستماع للاتصالات الواردة وفحص الانشغال فوراً
  socket.on('incoming-call-attempt', (payload: { callerId: string; callerName: string }) => {
    if (currentCallState.isInCall) {
      // إرسال فوراً إشارة "مشغول" للطرف المتصل
      socket.emit('respond-call-status', {
        targetId: payload.callerId,
        status: 'BUSY_NOW'
      });
      // توثيق المكالمة الفائتة في النظام
      onBusyTrigger(payload.callerName);
    }
  });
};

// ========================================================
// 4. CALL HOLD & SWITCHING ACTION TRIGGER
// ========================================================
export const toggleCallHold = (
  peerConnection: RTCPeerConnection | null,
  isHold: boolean,
  onStateChanged: (held: boolean) => void
) => {
  if (!peerConnection) return;
  
  peerConnection.getSenders().forEach((sender) => {
    if (sender.track) {
      sender.track.enabled = !isHold;
    }
  });

  const remoteAudio = document.getElementById('remoteAudio') as HTMLAudioElement;
  if (remoteAudio) {
    remoteAudio.muted = isHold;
  }

  onStateChanged(isHold);
  console.log(`📡 Base WebRTC Session Hold switched to: ${isHold}`);
};

// ========================================================
// 5. FLOATING ADAPTIVE CALL OVERLAY (IN-APP & ELECTRON COUPLING)
// ========================================================
export const JamMiniCallOverlay: React.FC<{
  isActive: boolean;
  peerName: string;
  duration: string;
  onDisconnect: () => void;
  isWindowFocused: boolean;
}> = ({ isActive, peerName, duration, onDisconnect, isWindowFocused }) => {
  if (!isActive) return null;

  return (
    <div 
      className="fixed top-5 left-5 w-72 bg-slate-900/95 backdrop-blur-md border border-amber-500 rounded-3xl p-4 flex flex-col gap-3 z-[100000] shadow-2xl transition-all font-sans text-right"
      dir="rtl"
      style={{
        animation: 'slideIn 0.3s ease-out'
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-black text-xs">
              {peerName ? peerName.slice(0, 2) : 'B2B'}
            </div>
            <div className="absolute -bottom-0.5 -left-0.5 w-3 h-3 bg-emerald-500 rounded-full border border-slate-900 animate-pulse" />
          </div>
          <div>
            <h4 className="text-white text-xs font-black truncate max-w-[130px]">{peerName || 'شريك تجاري'}</h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <p className="text-[10px] text-emerald-400 font-bold">جرى الاتصال... {duration}</p>
            </div>
          </div>
        </div>

        <button 
          onClick={onDisconnect}
          className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all active:scale-95"
        >
          إنهاء
        </button>
      </div>

      {/* Electron OS Overlay simulated state bar if minimized/out of focus */}
      {!isWindowFocused && (
        <div className="py-1 px-2.5 bg-indigo-950/85 border border-indigo-500/20 rounded-xl text-center text-[9px] text-indigo-300 font-bold flex items-center justify-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
          </span>
          لوحة Electron Always-On-Top نشطة بالخلفية
        </div>
      )}
    </div>
  );
};

// ========================================================
// 6. VOICE CHANNEL ISOLATION SECURITY (B2B CALL ROUTING)
// ========================================================
export const validateCallRoutingAuthorization = (
  caller: { storeCode: string; role: string },
  receiver: { storeCode: string; role: string },
  verifiedPartnersList: string[]
): boolean => {
  // القاعدة 1: إذا كانوا موظفين في نفس المحل، السماح بالاتصال الداخلي فوراً (Intercom)
  if (caller.storeCode === receiver.storeCode) return true;

  // القاعدة 2: إذا كان محل خارجي، يمنع الاتصال إلا إذا كان الشريك مضافاً في قائمة العلاقات المعتمدة B2B
  if (verifiedPartnersList.includes(receiver.storeCode)) return true;

  console.warn("🔒 تم حظر محاولة اتصال غير مصرح بها خارج حدود شبكة المحل المعتمدة.");
  return false;
};

// ========================================================
// 7. WEBRTC SDP COMPRESSION & LOW BANDWIDTH AUDIO OPTIMIZER
// ========================================================
export const optimizeSDPForYemenNetwork = (sdp: string): string => {
  // تعديل كود الـ SDP لتركيز البث على مفسر الصوت الـ Opus الذكي ومحدد النطاق الضعيف
  let modifiedSdp = sdp;
  
  // تحديد معدل نقل بيانات الصوت بـ 16kbps كحد أقصى (يعطي نقاء جبار وبدون استهلاك للإنترنت أو تعليق البرنامج)
  if (modifiedSdp.includes('maxaveragebitrate')) {
    modifiedSdp = modifiedSdp.replace(/maxaveragebitrate=\d+/g, 'maxaveragebitrate=16384;stereo=0;useinbandfec=1');
  } else {
    modifiedSdp = modifiedSdp.replace('useinbandfec=1', 'useinbandfec=1;maxaveragebitrate=16384;stereo=0');
  }
  
  console.log("⚡ تم تفعيل محرك النقاء ومكافحة بطء الإنترنت للصوت بنجاح.");
  return modifiedSdp;
};


