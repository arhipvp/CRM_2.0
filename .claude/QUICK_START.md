# Desktop App - Quick Start Guide

## 🚀 Running the Application

```bash
cd desktop_app
python main.py
```

Application will:
- ✅ Load 6 test clients
- ✅ Display enhanced logging
- ✅ Create log file in `logs/` directory

---

## 📊 Loading Test Data

### Option 1: Direct CRM API (Recommended)
```bash
cd desktop_app
python load_test_data.py http://localhost:8082/api/v1
```

**Result:**
- ✅ 5 test clients created
- ⚠️ Deals and policies need schema fix

### Option 2: Via Gateway (May fail)
```bash
cd desktop_app
python load_test_data.py
```

**Note:** Will fail with 503 if documents service is down

---

## 📝 Logging System

### Console Output Example:
```
[INFO] [02:25:33] Switched to tab: Clients
[INFO] [02:25:33] Loaded 6 clients
[WARNING] [02:25:34] Failed to fetch users: 404 Not Found
```

### Log File Location:
```
desktop_app/logs/desktop_app_YYYYMMDD_HHMMSS.log
```

---

## ✅ Current Status

**Test Data Loaded:**
- 6 Clients (5 new test clients)
- Ready for use

**Logging:**
- Enhanced logging system active
- All operations tracked
- Error details captured

---

**Last Updated:** 2025-10-31
