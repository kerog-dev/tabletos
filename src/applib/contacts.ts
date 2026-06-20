import { useEffect, useState } from "react";
import * as fs from "../fs.ts";

export interface Contact {
  name: string;
  id: string;
}

let contacts: Contact[];
let curListener: (() => void) | undefined = undefined;

async function read() {
  contacts = JSON.parse(await fs.readTextFile("/contacts.json"));
}
read();

async function write() {
  curListener?.();
  await fs.writeFile("/contacts.json", JSON.stringify(contacts));
}

export function useContacts() {
  const [sContacts, sSetContacts] = useState(contacts);

  useEffect(() => {
    const listener = () => sSetContacts(_ => [...contacts]);
    curListener = listener;
    return () => curListener = undefined;
  }, []);

  return sContacts;
}

export async function addContact(contact: Contact) {
  contacts.push(contact);
  await write();
}

export async function deleteContact(matcher: Partial<Contact>) {
  if (!matcher.name && !matcher.id) throw "Must provide either name or id to delete a contact";
  for (let i = 0; i < contacts.length; i++) {
    const c = contacts[i];
    if (matcher.name && matcher.name !== c.name) continue;
    if (matcher.id && matcher.id !== c.id) continue;
    contacts.splice(i, 1);
    await write();
    return;
  }
}

export async function setContactName(id: string, name: string) {
  const c = contacts.find(c => c.id === id);
  if (!c) throw "Contact not found!";
  c.name = name;
  await write();
}

export async function setContactId(name: string, id: string) {
  const c = contacts.find(c => c.name === name);
  if (!c) throw "Contact not found!";
  c.id = id;
  await write();
}

export function getContactName(id: string) {
  return contacts.find(c => c.id === id)?.name;
}

export function getContactId(name: string) {
  return contacts.find(c => c.name === name)?.id;
}

export function getContacts() {
  return [...contacts];
}
