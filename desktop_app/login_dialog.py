import tkinter as tk
from tkinter import messagebox
from i18n import i18n

class LoginDialog(tk.Toplevel):
    def __init__(self, parent):
        super().__init__(parent)
        self.transient(parent)
        self.parent = parent
        self.result = None

        self.title(i18n("Login"))

        tk.Label(self, text=f"{i18n('Username')}:").grid(row=0, column=0, padx=10, pady=5, sticky="w")
        self.username_var = tk.StringVar()
        tk.Entry(self, textvariable=self.username_var, width=30).grid(row=0, column=1, padx=10, pady=5)

        tk.Label(self, text=f"{i18n('Password')}:").grid(row=1, column=0, padx=10, pady=5, sticky="w")
        self.password_var = tk.StringVar()
        tk.Entry(self, textvariable=self.password_var, show="*", width=30).grid(row=1, column=1, padx=10, pady=5)

        button_frame = tk.Frame(self)
        button_frame.grid(row=2, columnspan=2, pady=10)

        tk.Button(button_frame, text=i18n("Login"), command=self.on_login).pack(side="left", padx=5)
        tk.Button(button_frame, text=i18n("Cancel"), command=self.destroy).pack(side="left", padx=5)

        self.grab_set()
        self.wait_window(self)

    def on_login(self):
        username = self.username_var.get().strip()
        password = self.password_var.get().strip()

        if not username or not password:
            messagebox.showerror(i18n("Error"), f"{i18n('Username')} and {i18n('Password')} cannot be empty.", parent=self)
            return

        self.result = {"username": username, "password": password}
        self.destroy()
