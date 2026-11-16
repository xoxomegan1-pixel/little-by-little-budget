# Upload to GitHub privately

1. Create a **Private** repository at https://github.com/new (suggested name: `little-by-little-budget`).
2. Extract the provided ZIP locally. Upload its **contents**, not the ZIP itself, using
   GitHub's **Add file → Upload files** option. Keep the folder structure.
3. Before clicking **Commit changes**, confirm the upload contains ONLY files in this review
   package. In particular there must be **no** `public/firebase-config.js`, `*.env`,
   exported budget JSON, passwords, or service-account JSON.
4. In the private repository, open **Settings → Collaborators** (sometimes under
   **Collaborators and teams**) and invite your friend's GitHub username.
5. Your friend can review the code and suggest changes in issues or pull requests.
   For a personal private GitHub repo, invited collaborators may have write access;
   invite only someone you trust and consider reviewing their changes before merging.
6. Keep the LIVE Firebase deployment separate. This code snapshot may not match the latest
   live code. A GitHub upload does **not** update the budgeting website.

The owner must keep the app's Help & backup → Download backup JSON privately and separately.
