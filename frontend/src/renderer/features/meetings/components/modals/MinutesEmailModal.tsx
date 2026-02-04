import { useState, useEffect } from 'react';
import { Mail, Download, Users, Check, Loader2 } from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { apiClient } from '../../../../lib/apiClient';

interface MinutesEmailModalProps {
    isOpen: boolean;
    onClose: () => void;
    meetingId: string;
    minutesId: string;
    meetingTitle: string;
    participants: any[]; // Using any[] to match MeetingWithParticipants structure loosely if needed
}

export const MinutesEmailModal = ({
    isOpen,
    onClose,
    meetingId,
    minutesId,
    meetingTitle,
    participants,
}: MinutesEmailModalProps) => {
    const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (isOpen && participants) {
            // Collect IDs of participants to pre-select
            // Backend expects user_ids (UUIDs).
            const validIds = participants
                .map(p => p.user_id || p.id)
                .filter(id => id);
            setSelectedRecipients(validIds);
        }
    }, [isOpen, participants]);

    const handleSend = async () => {
        if (selectedRecipients.length === 0) return;
        setLoading(true);
        try {
            await apiClient.post('/minutes/distribute', {
                meeting_id: meetingId,
                minutes_id: minutesId,
                channels: ['email'],
                recipients: selectedRecipients,
            });
            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                onClose();
            }, 2000);
        } catch (error) {
            console.error('Failed to send email:', error);
            alert('Gửi email thất bại');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPdf = () => {
        // Simple print for now
        window.print();
    };

    const toggleRecipient = (id: string) => {
        setSelectedRecipients(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Gửi biên bản & Tải PDF"
            size="md"
        >
            <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 dark:bg-blue-900/20 dark:border-blue-800">
                    <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-1">
                        Biên bản cuộc họp: {meetingTitle}
                    </h4>
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                        Biên bản đã sẵn sàng. Bạn có thể gửi email cho thành viên hoặc tải về dưới dạng PDF.
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                        <Users size={16} /> Người nhận ({selectedRecipients.length})
                    </label>
                    <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-2">
                        {participants.length === 0 && <span className="text-gray-500 text-sm p-2">Không có người tham gia.</span>}
                        {participants.map(p => {
                            const id = p.user_id || p.id;
                            // Handle nested user object or direct fields
                            const email = p.email || p.user?.email || 'No Email';
                            const name = p.name || p.user?.full_name || p.user?.username || 'Người tham gia';
                            const isSelected = selectedRecipients.includes(id);

                            if (!id) return null;

                            return (
                                <div key={id}
                                    className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}
                                    onClick={() => toggleRecipient(id)}
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                                            {isSelected && <Check size={12} className="text-white" />}
                                        </div>
                                        <div className="truncate">
                                            <div className="text-sm font-medium truncate">{name}</div>
                                            <div className="text-xs text-gray-500 truncate">{email}</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
                    <button className="btn btn--secondary" onClick={handleDownloadPdf}>
                        <Download size={16} className="mr-2" />
                        Tải PDF
                    </button>
                    <button
                        className="btn btn--primary"
                        onClick={handleSend}
                        disabled={loading || selectedRecipients.length === 0}
                    >
                        {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : <Mail size={16} className="mr-2" />}
                        {success ? 'Đã gửi!' : 'Gửi Email'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};
