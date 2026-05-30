# Security TDD and Invariants Specification

## 1. Data Invariants

- **User Profile Isolation**: User profiles can only be written and updated by the actual owner of that profile (`userId == request.auth.uid`). Users cannot elevate their own roles (`role` must remain 'user').
- **Test Integrity**: Test metadata and nested Questions can only be created, modified, or deleted by the user who uploaded them (`createdBy == request.auth.uid`). Other users can only read them.
- **Progress Protection**: A user's learning status, answers, and wrong question history are strictly PII. Only the owner of the progress (`userId == request.auth.uid`) is permitted to read, write, or update their progress document.
- **Group Privacy**: Groups and physical resources (shared tests, messages) can only be read or written by authenticated users who are verified members of that specific group.
- **Message Authenticity**: Message bodies are authenticated. The `userId` of a chat message must match the writing sender's authenticated UID (`userId == request.auth.uid`).

---

## 2. The "Dirty Dozen" Payloads

Here are 12 malicious payloads designed to threaten the system's security, and how the rules block them:

1. **Spoofed User Registration (Identity Theft)**
   - *Target Path*: `users/attacker_uid`
   - *Payload*: `{ "uid": "victim_uid", "email": "victim@gmail.com", "role": "admin" }`
   - *Result*: **PERMISSION_DENIED** (The document ID must match `request.auth.uid`, and role elevation is blocked).

2. **Privilege Escalation in Profile Update**
   - *Target Path*: `users/victim_uid`
   - *Payload*: `{ "role": "admin" }`
   - *Result*: **PERMISSION_DENIED** (Only the authenticated owner may write `users/victim_uid`, and they can't change `role` to 'admin').

3. **Hijacking Someone Else's Test Document**
   - *Target Path*: `tests/victim_test_id`
   - *Payload*: `{ "createdBy": "victim_uid", "title": "Hacked Test Name", "questionCount": 10 }`
   - *Result*: **PERMISSION_DENIED** (Only the test creator can write or update their test document).

4. **Injecting Questions to Another User's Test**
   - *Target Path*: `tests/victim_test_id/questions/malicious_question_id`
   - *Payload*: `{ "testId": "victim_test_id", "questionText": "Malicious payload", "options": ["A"], "correctOptionIndex": 0, "originalIndex": 0 }`
   - *Result*: **PERMISSION_DENIED** (Requires owner status on the parent test document).

5. **Resource Exhaustion (Denial-of-Wallet ID Poisoning)**
   - *Target Path*: `tests/AVeryLongIdOver128Characters_AVeryLongIdOver128Characters_AVeryLongIdOver128Characters_AVeryLongIdOver128Characters_AVeryLongIdOver128Characters`
   - *Payload*: `{ "title": "Spam Test" }`
   - *Result*: **PERMISSION_DENIED** (Document ID fails `isValidId` size filter).

6. **Blanket Querying / Scraping Progress Collections**
   - *Query target*: `progress` collection without any filter.
   - *Payload*: `getDocs(collection(db, "progress"))`
   - *Result*: **PERMISSION_DENIED** (Database-level rules enforce queries must filter by `userId == request.auth.uid`).

7. **Reading Progress of Another Student**
   - *Target Path*: `progress/other_user_progress_id`
   - *Payload*: `getDoc(doc(db, "progress", "test3_otheruser"))`
   - *Result*: **PERMISSION_DENIED** (Only matching progress owner has read/write permissions).

8. **Group Spying (Entering Chat Room without Membership)**
   - *Target Path*: `groups/secret_group_id/messages/msg_999`
   - *Payload*: `getDoc(doc(db, "groups", "secret_group_id", "messages", "msg_999"))`
   - *Result*: **PERMISSION_DENIED** (Requires active membership validation in `/groups/secret_group_id/members/request.auth.uid`).

9. **Spoofing Chat Sender UID (Impersonation)**
   - *Target Path*: `groups/group_123/messages/msg_1`
   - *Payload*: `{ "userId": "victim_uid", "userName": "Victim User", "text": "I am resigning!", "createdAt": "SERVER_TIMESTAMP" }`
   - *Result*: **PERMISSION_DENIED** (Chat sender ID must be identical to `request.auth.uid`).

10. **State Shortcutting in Progress Trackers**
    - *Target Path*: `progress/test1_victim`
    - *Payload*: `{ "isCompleted": true, "correctCount": 999999, "wrongQuestions": [] }`
    - *Result*: **PERMISSION_DENIED** (Checked by progress validation engine on size, type, and bounds).

11. **Altering Shared Tests by Non-Owners**
    - *Target Path*: `groups/group_123/sharedTests/test_1`
    - *Payload*: `{ "testId": "test_1", "sharedBy": "attacker_uid" }`
    - *Result*: **PERMISSION_DENIED** (Only the group owner/admin can share tests or make modifications in a group's SharedTests subcollection).

12. **Malicious Invite Code Hijack**
    - *Target Path*: `groups/group_123`
    - *Payload*: `{ "code": "NEW_CODE_HACK" }`
    - *Result*: **PERMISSION_DENIED** (Only the group creator can update group metadata).

---

## 3. Test Runner Specification

The Firestore unit tests verify these invariants using firestore security rules emulator.
All writes of the 12 malicious payloads must return a strict transaction rollback.
