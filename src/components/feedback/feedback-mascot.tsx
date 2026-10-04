"use client";

import { useEffect, useRef, useState } from "react";
import { FeedbackForm } from "./feedback-form";

/**
 * A small friendly "face" built from the same near-black + electric-lime
 * language as the landing page's hero core, rather than a generic chat-
 * bubble icon — a tiny, deliberately simple mascot, not an illustration.
 */
function MascotFace() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <circle cx="9" cy="11" r="1.6" fill="#B8FF00" />
      <circle cx="15" cy="11" r="1.6" fill="#B8FF00" />
      <path
        d="M8.5 15c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8"
        stroke="#B8FF00"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function FeedbackMascot({
  defaultName,
  defaultEmail,
}: {
  defaultName: string;
  defaultEmail: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [openCount, setOpenCount] = useState(0);

  function open() {
    setOpenCount((count) => count + 1);
    dialogRef.current?.showModal();
  }
  function close() {
    dialogRef.current?.close();
  }

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    function handleBackdropClick(event: MouseEvent) {
      if (event.target === node) close();
    }
    node.addEventListener("click", handleBackdropClick);
    return () => node.removeEventListener("click", handleBackdropClick);
  }, []);

  return (
    <>
      <div className="group fixed right-5 bottom-5 z-40">
        <span
          role="tooltip"
          className="pointer-events-none absolute right-full bottom-1/2 mr-2 translate-y-1/2 rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-background opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100"
        >
          Give Feedback
        </span>
        <button
          type="button"
          onClick={open}
          aria-label="Give feedback"
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground shadow-lg transition-transform duration-150 hover:scale-105 focus-visible:scale-105"
        >
          <MascotFace />
        </button>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="feedback-dialog-title"
        className="m-auto w-full max-w-md rounded-xl border border-border bg-surface p-0 shadow-xl backdrop:bg-foreground/40"
      >
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="feedback-dialog-title" className="text-base font-semibold text-foreground">
              Give feedback
            </h2>
          </div>
          <FeedbackForm key={openCount} defaultName={defaultName} defaultEmail={defaultEmail} onDone={close} />
        </div>
      </dialog>
    </>
  );
}
