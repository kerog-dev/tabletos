import type { Service } from "../../packages.ts";
import { randomId } from "../../utils.ts";

interface MailPartText {
  type: "text";
  content: string;
}

interface MailPartFile {
  type: "file";
  blobEncoded: string;
}

export type MailPart = MailPartText | MailPartFile;

interface Mail {
  id: string;
  sentAt: number;
  to: string[];
  from: string;
  subject: string;
  content: MailPart[];
}

interface MailRequest {
  to: string[];
  subject: string;
  content: MailPart[];
}

interface MailServiceObject {
  sendMail(mail: Mail): void;
}

interface MailInfo {
  id: string;
  sentAt: number;
  to: string[];
  from: string;
  subject: string;
}

export interface Controller {
  sendMail(mail: MailRequest): void;
  useMailInfos(box: "inbox" | "outbox"): MailInfo[];
  useMail(id: string | null): Mail | null;
  deleteMail(id: string): void;
}

interface DBOutboxMail {
  mail: Mail;
  delivery: string[];
}

interface DB {
  inbox: Mail[];
  outbox: DBOutboxMail[];
}

function isDbOutboxMail(m: Mail | DBOutboxMail): m is DBOutboxMail {
  return (m as any).mail !== undefined && (m as any).delivery !== undefined;
}

const service: Service = {
  info: {
    name: "Mail Service",
    autostart: true,
  },
  async start(sdk) {
    const appDir = await sdk.getAppDir("Mail");
    const db = await sdk.jsonDB<DB>(`${appDir}/servicedb.json`);

    db.object.inbox ??= [];
    db.object.outbox ??= [];

    const object: MailServiceObject = {
      sendMail(req) {
        const mail: Mail = {
          ...req,
          sentAt: Date.now(),
        };
        db.object.inbox.push(mail);
      },
    };

    sdk.conn.exposeObject(
      object,
      "mail",
      true,
      (path, args: Mail[], from) => path.path === "sendMail" && args[0].from === from,
    );

    const controller: Controller = {
      sendMail(req) {
        const mail: DBOutboxMail = {
          mail: { ...req, id: randomId(16), sentAt: Date.now(), from: sdk.conn.name },
          delivery: [],
        };
        db.object.outbox.push(mail);
        doDelivery(mail);
      },
      useMailInfos(box) {
        return db.use<(Mail | DBOutboxMail)[]>(box).map(mail =>
          isDbOutboxMail(mail)
            ? ({
              subject: mail.mail.subject,
              id: mail.mail.id,
              sentAt: mail.mail.sentAt,
              to: mail.mail.to,
              from: mail.mail.from,
            })
            : ({
              subject: mail.subject,
              id: mail.id,
              sentAt: mail.sentAt,
              to: mail.to,
              from: mail.from,
            })
        );
      },
      useMail(id) {
        const inbox = db.use<Mail[]>("inbox");
        const outbox = db.use<DBOutboxMail[]>("outbox").map(m => m.mail);
        return [...inbox, ...outbox].find(m => m.id === id) ?? null;
      },
      deleteMail(id) {
        db.object.inbox = db.object.inbox.filter(m => m.id !== id);
        db.object.outbox = db.object.outbox.filter(m => m.mail.id !== id);
      },
    };

    function doDelivery(target?: DBOutboxMail) {
      for (const mail of target ? [target] : db.object.outbox) {
        if (mail.delivery.length === mail.mail.to.length) continue;
        const toTry = mail.mail.to.filter(to => !mail.delivery.includes(to));
        for (const to of toTry) {
          sdk.conn.call<void>(`${to}::mail::sendMail`, [mail.mail], true).then(() => {
            mail.delivery.push(to);
            sdk.toast({ title: `Delivered ${mail.mail.subject} to ${to}` });
          })
            .catch(() => {});
        }
      }
    }

    doDelivery();
    setInterval(() => doDelivery(), 5 * 60 * 1_000);

    return {
      exposed: controller,
      stop() {
        sdk.conn.unexposeObject("mail");
      },
    };
  },
};

export default service;
