const {
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
} = require('@discordjs/voice');
const { escapeMarkdown } = require('discord.js');
const youtube = require('./sources/youtube');
const { selectCandidates } = require('./autoplay');
const stats = require('./stats');
const stations = require('./stations');
const panel = require('../utils/panel');
const UserError = require('../utils/UserError');

const MAX_QUEUE = 100;
const MAX_ATTEMPTS = 2; // เล่นไม่ได้ → ลองใหม่อีก 1 ครั้ง
const IDLE_TIMEOUT_MS = 3 * 60_000; // คิวหมดนานเท่านี้ → ออกจากห้อง
const ALONE_TIMEOUT_MS = 60_000; // ไม่มีคนในห้องนานเท่านี้ → ออกจากห้อง
const AUTOPLAY_PREFETCH = 2; // Autoplay เติมคิวล่วงหน้าให้มีเพลงรอเล่นไม่เกินเท่านี้
const AUTOPLAY_MIX_SIZE = 15; // ดึงรายการจาก Mix กี่รายการต่อครั้ง (รวมเพลงต้นทาง)
const AUTOPLAY_MAX_CANDIDATES = 10; // ตรวจ candidate สูงสุดกี่รายการต่อรอบ
const HISTORY_LIMIT = 50; // จำ Video ID ของเพลงที่เล่นล่าสุดกี่เพลง
const RADIO_MIN_PLAY_MS = 10_000; // สถานีเล่นได้ไม่ถึงเท่านี้ = ถือว่าล้มเหลว
const RADIO_MAX_FAILURES = 3; // ล้มเหลวติดกันเท่านี้ → ปิดวิทยุ (กันวนไม่รู้จบ)

// ข้อมูลการเล่นเพลงของ 1 Server
// (อนาคต: loop, shuffle จะเพิ่มที่คลาสนี้)
class GuildQueue {
  constructor(connection, textChannel) {
    this.connection = connection;
    this.textChannel = textChannel; // ช่องแชทที่จะประกาศ Now Playing (อัปเดตทุกครั้งที่มีคน /play)
    this.player = createAudioPlayer();
    // เพลงที่กำลังเล่น { id, title, url, duration, thumbnail, requestedBy, autoplay? }
    // (autoplay: true = ระบบเลือกให้ ไม่ได้มีคนสั่ง, requestedBy เป็น null)
    this.current = null;
    this.tracks = []; // เพลงที่รอเล่น (ไม่รวมเพลงที่กำลังเล่น)
    this.volume = 100; // ระดับเสียง (%) ใช้กับทุกเพลงในคิวนี้
    this.muted = false; // ปิดเสียงอยู่ (volume เดิมยังจำไว้ ใช้ตอน Unmute)
    this.idleTimer = null;
    this.aloneTimer = null;

    this.autoplay = false;
    this.history = []; // Video ID ของเพลงที่เล่นล่าสุด (เก่า → ใหม่) สูงสุด HISTORY_LIMIT
    this.lastPlayed = null; // เพลงล่าสุดที่เริ่มเล่น (ใช้เป็นต้นทางของ Autoplay)
    this.autoplayBusy = false; // กำลังดึง Mix อยู่ (กันหาซ้อนกัน)
    this.autoplayRound = 0; // เพิ่มทุกครั้งที่ /stop, ปิด Autoplay, ออกจากห้อง → ผลที่ค้างอยู่จะถูกทิ้ง

    this.backStack = []; // เพลงที่เล่นไปแล้ว (สำหรับปุ่ม Back) สูงสุด HISTORY_LIMIT
    this.goingBack = false; // กำลังย้อนกลับ → ไม่ต้องจำเพลงปัจจุบันลง backStack
    this.panelMessage = null; // ข้อความ Music Panel ของเพลงที่กำลังเล่น
    this.panelTrack = null; // เพลงของ Panel นั้น (ใช้ตอนย่อเป็นบรรทัดเดียว)
    this.lastEnded = null; // { track, ended } เพลงล่าสุดที่จบ + สาเหตุ

    // โหมดวิทยุ (/lofi): สถานีที่เปิดอยู่ (null = ปิด) — คิวว่างเมื่อไหร่ จะกลับมาเล่นสถานีนี้
    this.radio = null;
    this.radioFailures = 0; // จำนวนครั้งติดกันที่สถานีเล่นได้ไม่ถึง RADIO_MIN_PLAY_MS

    // ต่อ player เข้ากับห้องเสียง
    connection.subscribe(this.player);

    // เพลงจบ / ถูกหยุด / เล่นไม่ได้
    this.player.on(AudioPlayerStatus.Idle, (oldState) => {
      const { resource } = oldState;
      const { track, process, attempt, stoppedManually, ended } = resource.metadata;
      youtube.killProcess(process);
      this.current = null;

      // เล่นได้ไม่ถึง 1 วินาที (เช่น YouTube ตอบ 403) และไม่ได้ถูก /skip /stop = เพลงพัง
      // (ใช้ resource.started ไม่ได้ เพราะ FFmpeg ส่งข้อมูลส่วนหัวออกมาก่อนปิด ทำให้ started เป็น true)
      const failed = resource.playbackDuration < 1000 && !stoppedManually;
      if (failed && attempt < MAX_ATTEMPTS) {
        console.warn(`[queue] "${track.title}" เล่นไม่ได้ ลองใหม่ครั้งที่ ${attempt + 1}`);
        this.startTrack(track, attempt + 1);
        return;
      }

      // เพลงนี้จบแล้ว → ย่อ Panel ของมันเป็นบรรทัดเดียว พร้อมสาเหตุ (ถ้าไม่มี Panel ให้แจ้งเป็นข้อความแทน)
      this.lastEnded = { track, ended: ended ?? { reason: failed ? 'failed' : 'finished' } };
      if (!this.closePanel(this.lastEnded.ended) && failed) {
        this.notify(panel.notice(`⚠️ Couldn't play **${escapeMarkdown(track.title)}** — skipping to the next song`));
      }

      // สถานีวิทยุหลุดเร็วผิดปกติติดกันหลายครั้ง → ปิดวิทยุ ไม่งั้นจะต่อใหม่วนไม่รู้จบ
      if (track.live && !stoppedManually && this.radio) {
        this.radioFailures = resource.playbackDuration < RADIO_MIN_PLAY_MS ? this.radioFailures + 1 : 0;
        if (this.radioFailures >= RADIO_MAX_FAILURES) {
          this.notify(panel.notice(`📻 Lost connection to **${this.radio.label}** too many times — radio stopped`));
          this.radio = null;
        }
      }
      this.playNext();
    });

    this.player.on('error', (error) => {
      console.error(`[player] เล่น "${error.resource.metadata.track.title}" ไม่สำเร็จ:`, error.message);
    });
  }

  // เพิ่มเพลงของ User: ถ้าไม่มีอะไรเล่นอยู่ให้เล่นทันที (คืน 0) ไม่งั้นเข้าคิว (คืนลำดับในคิว)
  // เพลงของ User จะถูกแทรก "ก่อน" เพลง Autoplay ตัวแรกเสมอ (User มี Priority สูงกว่า)
  add(track) {
    if (!this.current) {
      this.startTrack(track);
      return 0;
    }
    // กำลังเปิดวิทยุ → เพลงที่สั่งแทรกเล่นทันที (คิวหมดแล้ววิทยุจะกลับมาเอง)
    if (this.current.live) {
      this.tracks.unshift(track);
      this.stopCurrent({ reason: 'interrupted' }); // → Idle → playNext() เล่นเพลงนี้
      return 0;
    }
    if (this.tracks.length >= MAX_QUEUE) {
      throw new UserError(`คิวเต็มแล้ว (สูงสุด ${MAX_QUEUE} เพลง)`);
    }
    const firstAutoplay = this.tracks.findIndex((t) => t.autoplay);
    const index = firstAutoplay === -1 ? this.tracks.length : firstAutoplay;
    this.tracks.splice(index, 0, track);
    return index + 1;
  }

  // ดึงเพลงแรกในคิวมาเล่น
  // คิวว่าง: เปิดวิทยุอยู่ → เล่นสถานีต่อ / Autoplay เปิด → หาเพลงมาเล่นต่อ / ไม่งั้น → เริ่มนับเวลาออกจากห้อง
  playNext() {
    const next = this.tracks.shift();
    if (!next) {
      if (this.radio) this.playStation();
      else if (this.autoplay) this.fillAutoplay();
      else this.startIdleTimer();
      return;
    }

    try {
      this.startTrack(next);
    } catch (error) {
      // เริ่มเล่นไม่ได้ (เช่น หา FFmpeg ไม่เจอ) → log แล้วข้ามไปเพลงถัดไป
      console.error(`[queue] เริ่มเล่น "${next.title}" ไม่ได้:`, error.message);
      this.playNext();
      return;
    }

    this.sendPanel();
  }

  // attempt = ครั้งที่เท่าไหร่ที่พยายามเล่นเพลงนี้ (เริ่มที่ 1)
  startTrack(track, attempt = 1) {
    clearTimeout(this.idleTimer);
    const process = youtube.createStream(track.url);
    // metadata = ข้อมูลที่เราแนบไปกับเสียง เพื่อใช้ตอนเพลงจบ/เกิด Error
    // inlineVolume = เปิดให้ปรับระดับเสียงระหว่างเล่นได้
    const resource = createAudioResource(process.stdout, {
      metadata: { track, process, attempt, stoppedManually: false },
      inlineVolume: true,
    });
    resource.volume.setVolumeLogarithmic(this.muted ? 0 : this.volume / 100);
    this.player.play(resource);
    this.current = track;

    // ครั้งแรกที่เริ่มเพลงนี้ (ไม่ใช่รอบลองใหม่): จำลง history และให้ Autoplay เติมคิวล่วงหน้า
    // (สถานีวิทยุไม่นับ: ไม่ใช่เพลง จึงไม่เข้า history / ปุ่ม Back / สถิติ / ต้นทางของ Autoplay)
    if (attempt === 1 && !track.live) {
      // จำเพลงก่อนหน้าไว้ให้ปุ่ม Back (ยกเว้นตอนที่กำลังย้อนกลับเอง ไม่งั้นจะวนไปมา)
      if (this.lastPlayed && !this.goingBack) {
        this.backStack.push(this.lastPlayed);
        if (this.backStack.length > HISTORY_LIMIT) this.backStack.shift();
      }
      this.goingBack = false;
      this.lastPlayed = track;
      this.history.push(track.id);
      if (this.history.length > HISTORY_LIMIT) this.history.shift(); // ลบรายการเก่าสุด
      track.started = true; // เคยเล่นแล้ว (ถ้าปุ่ม Back ดันกลับเข้าคิว จะไม่ถูกทิ้งตอนรีเฟรช Autoplay)
      // นับเฉพาะเพลงที่คนสั่งเอง (ถ้านับเพลง Autoplay ด้วย มันจะยิ่งเลือกเพลงเดิมวนไปเอง)
      if (!track.autoplay) stats.recordPlay(this.guildId, track);
      this.refreshAutoplay();
    }
  }

  // Autoplay ต้องอิงเพลงที่กำลังเล่นเสมอ: ทุกครั้งที่เพลงเริ่ม ทิ้งเพลง Autoplay ที่ยังไม่เคยเล่น
  // (หามาจากเพลงก่อนหน้า) แล้วหาใหม่จาก Mix ของเพลงนี้ — เพลงที่คนสั่งเองไม่ถูกทิ้ง
  refreshAutoplay() {
    if (this.autoplay) {
      const before = this.tracks.length;
      this.tracks = this.tracks.filter((t) => !(t.autoplay && !t.started));
      const dropped = before - this.tracks.length;
      if (dropped > 0) console.log(`[autoplay] refresh for "${this.current.title}": dropped ${dropped} old autoplay track(s)`);
    }
    this.fillAutoplay();
  }

  // ส่งข้อความลงช่องแชท: ถ้าพัง (สร้างการ์ด/ส่งไม่ได้) แค่ log ไม่กระทบเพลง
  async notify(message) {
    try {
      await this.textChannel.send(message);
    } catch (error) {
      console.error('[queue] ส่งข้อความไม่ได้:', error.message);
    }
  }

  // เล่นเพลงปัจจุบันมาแล้วกี่มิลลิวินาที
  get elapsedMs() {
    return this.player.state.resource?.playbackDuration ?? 0;
  }

  get paused() {
    return this.player.state.status === AudioPlayerStatus.Paused;
  }

  // ปรับระดับเสียง (%) ของเพลงที่กำลังเล่นทันที และจำไว้ใช้กับเพลงถัดไป
  // Logarithmic = ปรับตามการรับรู้ของหูคน (50% จะรู้สึกเบาลงครึ่งหนึ่งจริง ๆ)
  // (ตั้งระดับเสียงใหม่ระหว่าง Mute = เลิก Mute ไปด้วย)
  setVolume(percent) {
    this.volume = percent;
    this.muted = false;
    this.player.state.resource?.volume?.setVolumeLogarithmic(percent / 100);
  }

  // Mute ↔ Unmute: เงียบทันที โดยจำระดับเสียงเดิมไว้ / เพลงถัดไปก็ยังเงียบจนกว่าจะ Unmute
  toggleMute() {
    this.muted = !this.muted;
    this.player.state.resource?.volume?.setVolumeLogarithmic(this.muted ? 0 : this.volume / 100);
    return this.muted;
  }

  // หยุดชั่วคราว: คืน true ถ้าสำเร็จ (false = ไม่ได้เล่นอยู่ หรือหยุดอยู่แล้ว)
  pause() {
    return this.player.pause();
  }

  // เล่นต่อ: คืน true ถ้าสำเร็จ (false = ไม่ได้หยุดชั่วคราวอยู่)
  resume() {
    return this.player.unpause();
  }

  // ข้ามเพลง: player.stop() ทำให้เกิด Idle แล้ว Idle จะเล่นเพลงถัดไปเอง
  // by = userId ของคนที่สั่ง (แสดงในบรรทัดย่อ) / คืนเพลงที่ถูกข้าม (null = ไม่มีเพลงเล่นอยู่)
  skip(by) {
    const skipped = this.current;
    if (skipped) this.stopCurrent({ reason: 'skipped', by });
    return skipped;
  }

  // หยุดและล้างคิว: ต้องล้างคิวก่อน ไม่งั้น Idle จะไปเล่นเพลงถัดไปต่อ
  // ปิด Autoplay ด้วย ไม่งั้น Autoplay จะหาเพลงมาเล่นต่อทันทีที่คิวว่าง
  // คืน true ถ้า Autoplay เปิดอยู่ก่อนหยุด
  stop(by, reason = 'stopped') {
    const wasAutoplay = this.autoplay;
    if (wasAutoplay) console.log(`[autoplay] OFF by stop (guild ${this.guildId})`);
    this.autoplay = false;
    this.radio = null; // ปิดวิทยุด้วย ไม่งั้นคิวว่างแล้วสถานีจะกลับมาเล่นเอง
    this.autoplayRound++;
    this.tracks = [];
    this.stopCurrent({ reason, by });
    return wasAutoplay;
  }

  // ติดป้ายว่า "ผู้ใช้สั่งหยุดเอง" ก่อนหยุด เพื่อไม่ให้ Idle เข้าใจผิดว่าเพลงพังแล้วลองใหม่
  // ended = สาเหตุที่จบ (ใช้แสดงในบรรทัดย่อของ Panel)
  stopCurrent(ended) {
    const resource = this.player.state.resource;
    if (resource) Object.assign(resource.metadata, { stoppedManually: true, ended });
    this.player.stop(true);
  }

  // ปุ่ม Back: เล่นเพลงก่อนหน้า ส่วนเพลงที่กำลังเล่นถูกดันกลับไปเป็นคิวลำดับแรก
  // คืนเพลงที่ย้อนกลับไป (null = ไม่มีเพลงก่อนหน้า)
  back(by) {
    const previous = this.backStack.pop();
    if (!previous) return null;

    if (this.current) this.tracks.unshift(this.current);
    this.tracks.unshift(previous);
    this.goingBack = true;
    if (this.current) this.stopCurrent({ reason: 'back', by }); // → Idle → playNext() เล่น previous
    else this.playNext();
    return previous;
  }

  // ส่ง Music Panel ของเพลงที่กำลังเล่นลงช่องแชท (ส่งไม่ได้ → แค่ log)
  async sendPanel() {
    const track = this.current;
    try {
      this.setPanelMessage(await this.textChannel.send(panel.build(this)), track);
    } catch (error) {
      console.error('[panel] ส่ง Music Panel ไม่ได้:', error.message);
    }
  }

  // จำข้อความ Panel ของเพลง track
  setPanelMessage(message, track) {
    if (this.panelMessage && this.panelMessage.id !== message.id) this.closePanel({ reason: 'finished' });
    this.panelMessage = message;
    this.panelTrack = track;
    // เพลงจบไปแล้วระหว่างรอส่ง Panel (เช่น กด Skip เร็วมาก) → ย่อทันที
    if (this.current !== track) this.closePanel(this.lastEnded?.track === track ? this.lastEnded.ended : undefined);
  }

  // วาด Panel ปัจจุบันใหม่ตามสถานะล่าสุด (ใช้หลังคำสั่ง Slash ที่เปลี่ยน Pause / Mute / Autoplay)
  refreshPanel() {
    this.panelMessage?.edit(panel.build(this)).catch((error) => {
      console.error('[panel] อัปเดต Panel ไม่ได้:', error.message);
    });
  }

  // ย่อ Panel ปัจจุบันเป็นบรรทัดเดียว (ไม่มีการ์ด/ปุ่ม) — แก้ไม่ได้ เช่น ข้อความถูกลบ → แค่ log
  // คืน true ถ้ามี Panel ให้ย่อ
  closePanel(ended) {
    const message = this.panelMessage;
    if (!message) return false;
    this.panelMessage = null;
    message.edit(panel.compact(this.panelTrack, ended)).catch((error) => {
      console.error('[panel] ย่อ Panel ไม่ได้:', error.message);
    });
    return true;
  }

  // เปิดวิทยุสถานี key (จากเมนู /lofi หรือเมนูเปลี่ยนสถานีบน Radio Panel)
  // หาไลฟ์ให้ได้ก่อน (ระหว่างนี้เพลง/สถานีเดิมยังเล่นต่อ) แล้วค่อยสลับ — เพลงในคิวเดิมถูกล้าง
  // หาไลฟ์ไม่ได้ → throw UserError (สถานะเดิมไม่เปลี่ยน)
  async startRadio(key, by) {
    const station = stations.get(key);
    if (!station) throw new UserError('ไม่พบสถานีนี้');

    const track = { ...(await youtube.resolveLive(station)), requestedBy: by?.id ?? null };
    console.log(`[radio] ${station.label} → "${track.title}" (${track.id}) by ${by?.name ?? '-'}`);

    const switching = this.current?.live;
    this.radio = station;
    this.radioFailures = 0;
    this.autoplayRound++; // ทิ้งผลของ Autoplay ที่อาจกำลังหาอยู่
    this.tracks = [track];
    if (this.current) this.stopCurrent({ reason: switching ? 'switched' : 'stopped', by: by?.name }); // → Idle → playNext()
    else this.playNext();
    return station;
  }

  // คิวว่างระหว่างเปิดวิทยุ (เช่น เพลงที่แทรกเล่นจบ หรือไลฟ์ถูกตัด) → หาไลฟ์ของสถานีแล้วเล่นต่อ
  async playStation() {
    const station = this.radio;
    try {
      const track = { ...(await youtube.resolveLive(station)), requestedBy: null };
      if (this.radio !== station || this.current) return; // ระหว่างหา มีการเปลี่ยนสถานี/ปิดวิทยุ/เล่นเพลงอื่นไปแล้ว
      this.tracks.unshift(track);
      this.playNext();
    } catch (error) {
      if (this.radio !== station) return;
      console.error(`[radio] ${station.label}: ต่อสถานีไม่ได้ —`, error.message);
      this.radio = null;
      this.notify(panel.notice(`📻 Couldn't reach **${station.label}** — radio stopped. Use /lofi to try again`));
      if (!this.current) this.startIdleTimer();
    }
  }

  get guildId() {
    return this.connection.joinConfig?.guildId;
  }

  // เปิด/ปิด Autoplay — คืนจำนวนเพลง Autoplay ที่ถูกลบออกจากคิว (ตอนปิด)
  setAutoplay(on) {
    this.autoplay = on;
    console.log(`[autoplay] ${on ? 'ON' : 'OFF'} (guild ${this.guildId})`);

    if (on) {
      this.fillAutoplay(); // คิวว่างอยู่ → หาเพลงทันที / มีเพลงพอแล้ว → ไม่ทำอะไร
      return 0;
    }

    // ปิด: ทิ้งผลที่กำลังหาอยู่ และลบเพลง Autoplay ที่รออยู่ (เพลงของ User คงไว้)
    this.autoplayRound++;
    const before = this.tracks.length;
    this.tracks = this.tracks.filter((t) => !t.autoplay);
    // ไม่มีอะไรเล่นและคิวว่าง → กลับมานับเวลาออกจากห้องตามปกติ
    if (!this.current && this.tracks.length === 0) this.startIdleTimer();
    return before - this.tracks.length;
  }

  // Autoplay: หาเพลงจาก YouTube Mix ของเพลงล่าสุด แล้วเติมท้ายคิวให้มีเพลงรอเล่น AUTOPLAY_PREFETCH เพลง
  // ทำงานเบื้องหลัง: Error ทุกอย่างถูกจับไว้ในนี้ ไม่ทำให้ Player หรือบอทพัง
  async fillAutoplay() {
    if (!this.autoplay || this.radio || this.autoplayBusy) return; // เปิดวิทยุอยู่ → Autoplay พักไว้ก่อน
    if (this.tracks.length >= AUTOPLAY_PREFETCH) return; // คิวมีเพลงพอแล้ว

    const seed = this.current ?? this.lastPlayed; // เพลงที่กำลังเล่น หรือเพิ่งเล่น
    if (!seed) {
      // ยังไม่เคยเล่นเพลงเลย (เช่น /join แล้ว /autoplay) → รอให้มี /play ก่อน
      if (!this.current) this.startIdleTimer();
      return;
    }

    this.autoplayBusy = true;
    const round = this.autoplayRound;
    let added = 0;
    let seedChanged = false;
    try {
      console.log(`[autoplay] seed: "${seed.title}" (${seed.id})`);
      let entries = [];
      try {
        entries = await youtube.getMix(seed.id, AUTOPLAY_MIX_SIZE);
      } catch (error) {
        console.warn(`[autoplay] mix fetch failed (seed ${seed.id}): ${error.message}`);
      }

      // ระหว่างรอ yt-dlp มี /stop, ปิด Autoplay หรือออกจากห้อง → ทิ้งผลลัพธ์
      if (round !== this.autoplayRound) {
        console.log('[autoplay] discarded result (stopped/disabled while fetching)');
        return;
      }

      // ระหว่างรอ yt-dlp เพลงเปลี่ยนไปแล้ว → ผลนี้อิงเพลงเก่า ทิ้งแล้วหาใหม่จากเพลงปัจจุบัน (ทำใน finally)
      if (seed !== (this.current ?? this.lastPlayed)) {
        console.log(`[autoplay] seed changed while fetching ("${seed.title}" → "${(this.current ?? this.lastPlayed).title}"), refetching`);
        seedChanged = true;
        return;
      }

      const queuedIds = new Set(this.tracks.map((t) => t.id));
      if (this.current) queuedIds.add(this.current.id);
      const { picked, rejected } = selectCandidates(entries, {
        seedId: seed.id,
        recentIds: new Set(this.history),
        queuedIds,
        want: AUTOPLAY_PREFETCH - this.tracks.length,
        maxCandidates: AUTOPLAY_MAX_CANDIDATES,
        preferences: stats.preferences(this.guildId), // เพลง/ช่องที่ Server นี้เปิดบ่อยได้คะแนนเพิ่ม
      });

      for (const { entry, reason, index } of rejected) {
        console.log(`[autoplay] reject ${entry?.id} "${entry?.title}": ${reason} (candidate ${index}/${AUTOPLAY_MAX_CANDIDATES})`);
      }
      for (const { entry, index, score, favorite } of picked) {
        const fav = favorite > 0 ? `, favorite ${favorite.toFixed(1)}` : '';
        console.log(`[autoplay] pick ${entry.id} "${entry.title}" (candidate ${index}/${AUTOPLAY_MAX_CANDIDATES}, score ${score.toFixed(1)}${fav})`);
        // เติมท้ายคิวเสมอ → ไม่มีทางแทรกก่อนเพลงของ User
        this.tracks.push({ ...youtube.toTrack(entry), requestedBy: null, autoplay: true });
        added++;
      }

      if (added > 0) console.log(`[autoplay] added ${added} track(s), queue now ${this.tracks.length}`);
      else if (entries.length > 0) console.warn(`[autoplay] no suitable track (seed ${seed.id})`);
    } catch (error) {
      console.error('[autoplay] unexpected error:', error);
    } finally {
      this.autoplayBusy = false;
      if (seedChanged) this.fillAutoplay();
    }

    if (round !== this.autoplayRound) return;

    // ตอนนี้ไม่มีเพลงเล่นอยู่ (คิวหมดระหว่างที่หา)
    if (!this.current) {
      if (this.tracks.length > 0) {
        this.playNext();
      } else {
        // หาเพลงไม่ได้ → แจ้ง แล้วกลับไปใช้ระบบ "คิวหมด 3 นาทีแล้วออก"
        this.notify(panel.notice("🎵 Autoplay couldn't find another song — use /play to keep listening"));
        this.startIdleTimer();
      }
    }
  }

  // ล้างทุกอย่างเมื่อออกจากห้อง (เรียกจาก queueManager)
  destroy() {
    this.stop(null, 'left');
    clearTimeout(this.idleTimer);
    clearTimeout(this.aloneTimer);
  }

  // คิวหมด: ถ้าไม่มีใครเพิ่มเพลงภายใน 3 นาที → ออกจากห้อง
  startIdleTimer() {
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (!this.current) this.leave('💤 Nothing played for 3 minutes, so I left the voice channel');
    }, IDLE_TIMEOUT_MS);
  }

  // เรียกจาก event voiceStateUpdate: alone = ในห้องไม่มีคน (นอกจากบอท)
  setAlone(alone) {
    if (!alone) {
      clearTimeout(this.aloneTimer);
      this.aloneTimer = null;
    } else if (!this.aloneTimer) {
      this.aloneTimer = setTimeout(() => this.leave('👋 Everyone left, so I left the voice channel too'), ALONE_TIMEOUT_MS);
    }
  }

  leave(reason) {
    if (this.connection.state.status === VoiceConnectionStatus.Destroyed) return;
    this.notify(panel.notice(reason));
    this.connection.destroy(); // → queueManager จะเรียก destroy() ให้
  }
}

module.exports = GuildQueue;
