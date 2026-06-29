import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, X, Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DocumentAnalysis } from "@/lib/types";

interface SimpleShareViaEmailModalProps {
  show: boolean;
  onClose: () => void;
  subject: string;
  content: string;
}

const SimpleShareViaEmailModal: React.FC<SimpleShareViaEmailModalProps> = ({
  show,
  onClose,
  subject,
  content
}) => {
  const { toast } = useToast();
  const [recipientEmail, setRecipientEmail] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSendEmail = async () => {
    // Validate email
    if (!recipientEmail || !recipientEmail.includes('@')) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid recipient email address.",
        variant: "destructive"
      });
      return;
    }

    // Prepare email data
    const emailData = {
      recipientEmail,
      senderEmail: senderEmail || undefined,
      senderName: senderName || undefined,
      subject,
      content
    };

    setIsLoading(true);

    try {
      // Send the API request
      const response = await fetch('/api/share-simple-email', {
        method: 'POST',
        body: JSON.stringify(emailData),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Email sent",
          description: "The report has been shared successfully.",
          variant: "default"
        });
        onClose();
      } else {
        toast({
          title: "Error sending email",
          description: result.message || "Failed to send email",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Error sending email",
        description: error.message || "An unexpected error occurred while sharing the report.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={show} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Share Report via Email
          </DialogTitle>
          <DialogDescription>
            Send the report to yourself or others via email.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="recipient-email" className="text-right">
              To
            </Label>
            <Input
              id="recipient-email"
              type="email"
              placeholder="recipient@example.com"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="col-span-3"
              required
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="sender-name" className="text-right">
              From Name
            </Label>
            <Input
              id="sender-name"
              placeholder="Your Name (optional)"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              className="col-span-3"
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="sender-email" className="text-right">
              From Email
            </Label>
            <Input
              id="sender-email"
              type="email"
              placeholder="your.email@example.com (optional)"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              className="col-span-3"
            />
          </div>
        </div>
        
        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSendEmail} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SimpleShareViaEmailModal;