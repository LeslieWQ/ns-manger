<template>
  <div id="app">
    <div class="container">
      <header class="header">
        <span class="header-icon">🎮</span>
        <h1>NS 账号管理</h1>
      </header>

      <!-- 查看密码模态框 -->
      <div class="password-modal" :class="{ show: showPasswordModal }">
        <div class="modal-content">
          <div class="modal-title">🔐 输入解密密钥</div>
          <input
            type="password"
            class="modal-input"
            v-model="decryptKey"
            placeholder="请输入密钥"
            @keyup.enter="decryptPassword"
            ref="decryptInput"
          >
          <div
            class="modal-result"
            :style="{ display: decryptResult ? 'block' : 'none' }"
            :class="{ 'result-error': decryptError }"
          >
            {{ decryptResult }}
          </div>
          <div class="modal-buttons">
            <button class="modal-btn modal-btn-secondary" @click="closePasswordModal">取消</button>
            <button class="modal-btn modal-btn-primary" @click="decryptPassword">解密</button>
          </div>
        </div>
      </div>

      <div class="stats">
        <div class="stat-card">
          <div class="stat-value">{{ accounts.length }}</div>
          <div class="stat-label">账号数量</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ games.length }}</div>
          <div class="stat-label">游戏总数</div>
        </div>
      </div>

      <div class="stat-card total-spent-card">
        <div class="stat-value total-spent-value">¥{{ totalSpent.toFixed(2) }}</div>
        <div class="stat-label">游戏花费</div>
      </div>

      <div class="grid">
        <div class="card">
          <div class="card-title">👤 我的账号</div>
          <div class="list-container" id="accountList">
            <div v-if="accounts.length === 0" class="empty-state">暂无账号</div>
            <div
              v-for="acc in accounts"
              :key="acc.id"
              class="account-item"
            >
              <div class="account-header">
                <div>
                  <span class="account-name">{{ acc.name }}</span>
                  <span class="account-region">{{ getRegionFlag(acc.region) }}</span>
                </div>
                <div class="account-balance">
                  {{ getCurrencySymbol(acc.region) }}{{ (acc.balance || 0).toFixed(2) }}
                </div>
              </div>
              <div class="account-details">
                📧 {{ acc.email || '未设置' }}<br>
                🔑
                <span v-if="acc.password">
                  <span class="password-hidden">••••••</span>
                  <button class="view-pwd-btn" @click="viewPassword(acc.id, acc.password)">👁️</button>
                </span>
                <span v-else>未设置</span>
                <span v-if="acc.birthday"><br>🎂 {{ acc.birthday }}</span>
                <div class="account-total-spent">💰 ¥{{ (acc.total_spent || 0).toFixed(2) }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">🎯 数字版游戏</div>

          <!-- 搜索框 -->
          <input
            type="text"
            class="search-input"
            v-model="searchKeyword"
            placeholder="🔍 搜索游戏..."
          >

          <!-- 区服 Tab -->
          <div class="region-tabs">
            <button
              v-for="region in regions"
              :key="region.value"
              class="tab-btn"
              :class="{ active: currentRegion === region.value }"
              @click="currentRegion = region.value"
            >
              {{ region.label }}
            </button>
          </div>

          <div class="game-list" id="gameList">
            <div v-if="filteredGames.length === 0" class="empty-state">暂无游戏</div>
            <div
              v-for="game in filteredGames"
              :key="game.id"
              class="game-item"
            >
              <div>
                <div class="game-title">{{ game.title }}</div>
                <div class="game-meta">
                  {{ game.account_name || '未知账号' }}
                  {{ game.account_region ? getRegionFlag(game.account_region) : '' }}
                  {{ game.purchase_date ? ' · ' + game.purchase_date : '' }}
                </div>
              </div>
              <div class="game-price">
                {{ game.price > 0 ? '¥' + game.price : '免费' }}
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">💿 卡带游戏</div>
          <div class="game-list" id="cartridgeList">
            <div v-if="cartridgeGames.length === 0" class="empty-state">暂无卡带游戏</div>
            <div
              v-for="game in cartridgeGames"
              :key="game.id"
              class="game-item"
              style="border-left: 3px solid var(--accent-warning);"
            >
              <div class="game-content">
                <span class="game-icon">💿</span>
                <span class="game-title">{{ game.title }}</span>
              </div>
              <div class="game-price">
                {{ game.price > 0 ? '¥' + game.price : '' }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'App',
  data() {
    return {
      accounts: [],
      games: [],
      currentRegion: 'all',
      searchKeyword: '',
      showPasswordModal: false,
      decryptKey: '',
      decryptResult: '',
      decryptError: false,
      currentAccountId: null,
      currentPassword: null,
      regions: [
        { value: 'all', label: '全部' },
        { value: 'HK', label: '🇭🇰 香港' },
        { value: 'JP', label: '🇯🇵 日本' },
        { value: 'US', label: '🇺🇸 美国' },
        { value: 'BR', label: '🇧🇷 巴西' },
        { value: 'MX', label: '🇲🇽 墨西哥' }
      ]
    }
  },
  computed: {
    digitalGames() {
      return this.games.filter(g => g.account_id !== null)
    },
    cartridgeGames() {
      return this.games.filter(g => g.account_id === null || g.notes === '卡带')
    },
    filteredGames() {
      let filtered = this.digitalGames

      if (this.currentRegion !== 'all') {
        filtered = filtered.filter(g => g.account_region === this.currentRegion)
      }

      if (this.searchKeyword) {
        const keyword = this.searchKeyword.toLowerCase()
        filtered = filtered.filter(g =>
          g.title.toLowerCase().includes(keyword) ||
          (g.account_name && g.account_name.toLowerCase().includes(keyword))
        )
      }

      return filtered
    },
    totalSpent() {
      return this.games.reduce((sum, g) => sum + (g.price || 0), 0)
    }
  },
  created() {
    this.loadAccounts()
    this.loadGames()
  },
  methods: {
    async loadAccounts() {
      try {
        const res = await axios.get('/api/accounts')
        this.accounts = res.data
      } catch (error) {
        console.error('加载账号失败:', error)
      }
    },
    async loadGames() {
      try {
        const res = await axios.get('/api/games')
        this.games = res.data
      } catch (error) {
        console.error('加载游戏失败:', error)
      }
    },
    getRegionFlag(region) {
      const flags = {
        'JP': '🇯🇵 日本',
        'US': '🇺🇸 美国',
        'HK': '🇭🇰 香港',
        'CN': '🇨🇳 国服',
        'EU': '🇪🇺 欧服',
        'KR': '🇰🇷 韩服',
        'BR': '🇧🇷 巴西',
        'MX': '🇲🇽 墨西哥'
      }
      return flags[region] || region
    },
    getCurrencySymbol(region) {
      const currencies = {
        'JP': '¥',
        'US': '$',
        'HK': 'HK$',
        'CN': '¥',
        'EU': '€',
        'KR': '₩',
        'BR': 'R$',
        'MX': 'MX$'
      }
      return currencies[region] || '¥'
    },
    viewPassword(accountId, encryptedPassword) {
      this.currentAccountId = accountId
      this.currentPassword = encryptedPassword
      this.showPasswordModal = true
      this.decryptKey = ''
      this.decryptResult = ''
      this.decryptError = false
      this.$nextTick(() => {
        this.$refs.decryptInput && this.$refs.decryptInput.focus()
      })
    },
    closePasswordModal() {
      this.showPasswordModal = false
      this.currentAccountId = null
      this.currentPassword = null
      this.decryptKey = ''
      this.decryptResult = ''
      this.decryptError = false
    },
    async decryptPassword() {
      if (!this.decryptKey) {
        alert('请输入密钥')
        return
      }

      try {
        const response = await axios.post('/api/decrypt', {
          password: this.currentPassword,
          key: this.decryptKey
        })

        const result = response.data

        if (result.success) {
          this.decryptResult = '🔑 ' + result.password
          this.decryptError = false
        } else {
          this.decryptResult = '❌ ' + result.message
          this.decryptError = true
        }
      } catch (error) {
        this.decryptResult = '❌ 解密失败: ' + error.message
        this.decryptError = true
      }
    }
  }
}
</script>

<style>
:root {
  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  --bg-card: #21262d;
  --bg-hover: #30363d;
  --accent-primary: #58a6ff;
  --accent-secondary: #3fb950;
  --accent-warning: #d29922;
  --accent-danger: #f85149;
  --text-primary: #f0f6fc;
  --text-secondary: #8b949e;
  --border-color: #30363d;
  --border-hover: #8b949e;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  min-height: 100vh;
  padding: 24px;
  line-height: 1.6;
}

#app {
  min-height: 100vh;
}

.container {
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border-color);
  animation: slideDown 0.6s ease-out;
}

.header-icon {
  font-size: 32px;
}

.header h1 {
  font-family: 'JetBrains Mono', monospace;
  font-size: 28px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.5px;
}

.grid {
  display: flex;
  gap: 24px;
  margin-bottom: 24px;
}

.grid > .card {
  flex: 1;
  min-width: 0;
}

@media (max-width: 1024px) {
  .grid {
    flex-direction: column;
  }
}

.card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 20px;
  transition: all 0.2s ease;
  animation: fadeInUp 0.6s ease-out backwards;
}

.card:hover {
  border-color: var(--border-hover);
  transform: translateY(-2px);
}

.card:nth-child(1) { animation-delay: 0.1s; }
.card:nth-child(2) { animation-delay: 0.2s; }
.card:nth-child(3) { animation-delay: 0.3s; }

.stat-card {
  animation: fadeInUp 0.6s ease-out backwards;
  animation-delay: 0.15s;
}

.list-container {
  overflow-y: auto;
  padding-right: 4px;
}

@media (min-width: 1025px) {
  #gameList { max-height: 600px; }
  #cartridgeList { max-height: 730px; }
  #accountList { max-height: 730px; }
}

@media (max-width: 1024px) {
  #gameList, #cartridgeList {
    max-height: 430px;
  }
  #accountList {
    max-height: 400px;
  }
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 滚动条样式 */
.list-container::-webkit-scrollbar,
.game-list::-webkit-scrollbar {
  width: 8px;
}

.list-container::-webkit-scrollbar-track,
.game-list::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 4px;
}

.list-container::-webkit-scrollbar-thumb,
.game-list::-webkit-scrollbar-thumb {
  background: var(--border-hover);
  border-radius: 4px;
}

.list-container::-webkit-scrollbar-thumb:hover,
.game-list::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-input {
  width: 100%;
  padding: 10px 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 14px;
  margin-bottom: 16px;
  transition: all 0.2s ease;
}

.search-input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.15);
}

.region-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.tab-btn {
  padding: 8px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
  width: 100%;
}

.tab-btn:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.tab-btn.active {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: #ffffff;
}

.view-pwd-btn {
  margin-left: 8px;
  padding: 2px 6px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.view-pwd-btn:hover {
  color: var(--accent-primary);
  transform: scale(1.1);
}

.account-item {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  border-left: 3px solid var(--accent-primary);
  transition: all 0.2s ease;
}

.account-item:hover {
  background: var(--bg-hover);
  border-left-color: var(--accent-secondary);
}

.account-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.account-name {
  font-weight: 600;
  font-size: 15px;
  color: var(--text-primary);
  font-family: 'JetBrains Mono', monospace;
}

.account-balance {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  font-size: 16px;
  background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.account-region {
  font-size: 12px;
  padding: 4px 10px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-secondary);
  font-weight: 500;
}

.account-details {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 2;
}

.account-total-spent {
  margin-top: 4px;
}

.game-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-x: hidden;
  overflow-y: auto;
  padding-right: 4px;
}

.game-item {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid transparent;
  transition: all 0.2s ease;
  min-width: 0;
}

.game-item:hover {
  border-color: var(--accent-primary);
  background: var(--bg-hover);
  transform: translateX(4px);
}

.game-title {
  font-weight: 500;
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
  word-break: break-all;
}

.game-meta {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
  word-break: break-all;
}

.game-price {
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  white-space: nowrap;
  margin-left: 12px;
}

.game-content {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.game-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.empty-state {
  text-align: center;
  padding: 48px 20px;
  color: var(--text-secondary);
  font-size: 14px;
  border: 1px dashed var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
}

.stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: var(--bg-card);
  padding: 20px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  text-align: center;
}

.stat-value {
  font-size: 36px;
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1.1;
}

.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 8px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.total-spent-card {
  margin-bottom: 24px;
}

.total-spent-value {
  font-size: 48px;
  color: var(--accent-secondary);
}

/* 密码模态框 */
.password-modal {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  z-index: 1000;
  justify-content: center;
  align-items: center;
  backdrop-filter: blur(4px);
}

.password-modal.show {
  display: flex;
}

.modal-content {
  background: var(--bg-card);
  padding: 32px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  max-width: 420px;
  width: 90%;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 20px;
  color: var(--text-primary);
  text-align: center;
}

.modal-input {
  width: 100%;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 14px;
  margin-bottom: 16px;
  transition: all 0.2s ease;
}

.modal-input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.15);
}

.modal-result {
  padding: 14px;
  background: var(--bg-secondary);
  border-radius: 8px;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 16px;
  text-align: center;
  margin-bottom: 16px;
  border: 1px solid var(--border-color);
}

.modal-result:not(.result-error) {
  color: var(--accent-primary);
}

.result-error {
  color: var(--accent-danger) !important;
}

.modal-buttons {
  display: flex;
  gap: 12px;
}

.modal-btn {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.modal-btn-primary {
  background: var(--accent-primary);
  color: #ffffff;
}

.modal-btn-primary:hover {
  background: #409eff;
}

.modal-btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
}

.modal-btn-secondary:hover {
  border-color: var(--border-hover);
  color: var(--text-primary);
}
</style>
