import { useRef, useState } from "react";
import { sdk } from "../../getsdk.ts";
import { formatTime } from "../../utils.ts";
import mailIconUrl from "./icon.png?url";
import styles from "./Mail.module.css";
import type { Controller, MailPart } from "./service.ts";

const { sv, toast, tray } = sdk();

tray.set({
  id: "mail",
  name: "Mail",
  iconUrl: mailIconUrl,
  ui() {
    function Ready({ exposed }: { exposed: Controller }) {
      const info = exposed.useMailDeliveryInfo();

      return (
        <div>
          Mail not fully delivered: {info.filter(m => m.delivery.length < m.mail.to.length).length}
        </div>
      );
    }

    const exposed = sv.use<Controller>("Mail Service");
    return exposed ? <Ready exposed={exposed} /> : <>Loading...</>;
  },
});

function MailPart({ part }: { part: MailPart }) {
  switch (part.type) {
    case "text":
      return (
        <span style={{ whiteSpace: "pre-wrap" }}>
          {part.content}
          <br />
        </span>
      );

    case "file":
      break;

    default:
      part satisfies never;
  }
}

function Mail(
  { id, exposed, setMailSelected }: { id: string; exposed: Controller; setMailSelected: (id: string | null) => void },
) {
  const mail = exposed.useMail(id);
  if (!mail) return <div>Error: Mail not found</div>;

  return (
    <>
      <button onClick={() => setMailSelected(null)}>X</button>
      <button
        onClick={() => {
          exposed.deleteMail(id);
          setMailSelected(null);
        }}
      >
        Delete
      </button>
      <p>
        Sent at: {formatTime(mail.sentAt)}
        <br />
        From: {mail.from}
        <br />
        To: {mail.to}
        <br />
        Id: {mail.id}
        <br />
        Subject: {mail.subject}
        <br />
      </p>
      <p>
        {mail.content.map(p => <MailPart part={p} />)}
      </p>
    </>
  );
}

function Compose({ exposed }: { exposed: Controller }) {
  const [composing, setComposing] = useState(false);
  const composeToRef = useRef<HTMLInputElement | null>(null);
  const composeSubjectRef = useRef<HTMLInputElement | null>(null);
  const composeTextRef = useRef<HTMLTextAreaElement | null>(null);

  function composeSend() {
    if (!composeToRef.current || !composeSubjectRef.current || !composeTextRef.current) return;
    const toStr = composeToRef.current.value;
    const subject = composeSubjectRef.current.value;
    const text = composeTextRef.current.value;
    const to = toStr.split(" ");

    exposed.sendMail({
      to,
      subject,
      content: [{ type: "text", content: text }],
    });
    toast({ title: "Queued mail" });
  }

  return (
    <>
      <button className={styles["compose-btn"]} onClick={() => setComposing(true)}>Compose</button>
      <div className={styles.compose} style={{ display: composing ? "unset" : "none" }}>
        <button className={styles["compose-close-btn"]} onClick={() => setComposing(false)}>X</button>
        To: <input type="text" ref={composeToRef} />
        <br />
        Subject: <input type="text" ref={composeSubjectRef} />
        <br />
        <textarea ref={composeTextRef} />
        <button className={styles["compose-send-btn"]} onClick={() => composeSend()}>Send</button>
      </div>
    </>
  );
}

function MailAppReady({ exposed }: { exposed: Controller }) {
  const [boxSelected, setBoxSelected] = useState<"inbox" | "outbox">("inbox");
  const [mailSelected, setMailSelected] = useState<string | null>(null);

  return (
    <div className={styles.app}>
      <div className={styles.topbar}>
        <button
          className={boxSelected === "inbox" ? styles.selected : ""}
          onClick={() => setBoxSelected("inbox")}
        >
          Inbox
        </button>
        <button
          className={boxSelected === "outbox" ? styles.selected : ""}
          onClick={() => setBoxSelected("outbox")}
        >
          Outbox
        </button>
      </div>
      <div className={styles["mail-list-container"]}>
        <div className={styles["box-title"]}>{boxSelected === "inbox" ? "Inbox" : "Outbox"}</div>
        <div className={styles["mail-list"]}>
          {exposed.useMailInfos(boxSelected).reverse().map(x => (
            <div onDoubleClick={() => setMailSelected(x.id)}>
              {formatTime(x.sentAt)}: {x.subject}{" "}
              {boxSelected === "inbox" ? <>(from {x.from})</> : <>(to {x.to.join(", ")})</>}
            </div>
          ))}
        </div>
      </div>
      <div className={styles.mail} style={{ display: mailSelected ? "unset" : "none" }}>
        {mailSelected && <Mail id={mailSelected} exposed={exposed} setMailSelected={setMailSelected} />}
      </div>
      <Compose exposed={exposed} />
    </div>
  );
}

export default function MailApp() {
  const exposed = sv.use<Controller>("Mail Service");

  if (!exposed) {
    return (
      <div>
        Service is not running. <button onClick={() => sv.start("Mail Service")}>Start</button>
      </div>
    );
  }

  return <MailAppReady exposed={exposed} />;
}
