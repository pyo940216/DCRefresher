import { User } from '../structs/user'
import { PostInfo } from '../structs/post'
import { findNeighbor } from '../utils/dom'
import * as http from '../utils/http'

import * as Toast from '../components/toast'

import { ScrollDetection } from '../utils/scrollDetection'

/**
 * dcinside.com set cookie function
 */
function set_cookie_tmp (e: string, t: string, o: number, i: string) {
  var n = new Date()
  n.setTime(n.getTime() + 36e5 * o),
    (document.cookie =
      e +
      '=' +
      escape(t) +
      '; path=/; domain=' +
      i +
      '; expires=' +
      n.toUTCString() +
      ';')
}

/**
 * dcinside.com get cookie
 */
function get_cookie (e: string) {
  for (
    var t = e + '=', o = document.cookie.split(';'), i = 0;
    i < o.length;
    i++
  ) {
    for (var n = o[i]; ' ' == n.charAt(0); ) n = n.substring(1)
    if (0 == n.indexOf(t)) return n.substring(t.length, n.length)
  }
  return ''
}

interface GalleryPredata {
  gallery: string
  id: string
  title?: string
  link?: string
  notice?: boolean
  recommend?: boolean
}

interface GalleryHTTPRequestArguments {
  gallery: string
  id: string
  commentId?: string
  commentNo?: string
  link?: string
}

const ISSUE_ZOOM_ID = /\$\(document\)\.data\('comment_id'\,\s\'.+'\);/g
const ISSUE_ZOOM_NO = /\$\(document\)\.data\('comment_no'\,\s\'.+'\);/g

const QUOTES = /(["'])(?:(?=(\\?))\2.)*?\1/g

const getURL = (u: string) => {
  return !chrome || !chrome.extension ? u : chrome.extension.getURL(u)
}

let KEY_COUNTS: { [index: string]: any } = {}
let adminKeyPress: any = null

const panel = {
  block: (callback: Function, closeCallback: Function) => {
    let element = document.createElement('div')
    element.className = 'refresher-block-popup'

    element.innerHTML = `
      <div class="close">
        <div class="cross"></div>
        <div class="cross"></div>
      </div>
      <div class="contents">
        <div class="block">
          <h3>차단 기간</h3>
          <div class="block_duration">
            <label><input type='radio' name='duration' value='1' checked='checked' />1시간</label>
            <label><input type='radio' name='duration' value='6' />6시간</label>
            <label><input type='radio' name='duration' value='24' />24시간</label>
            <label><input type='radio' name='duration' value='168' />7일</label>
            <label><input type='radio' name='duration' value='336' />14일</label>
            <label><input type='radio' name='duration' value='720' />30일</label>
          </div>
        </div>
        <div class="block">
          <h3>차단 사유</h3>
          <div class="block_reason">
            <label><input type='radio' name='reason' value='1' checked='checked' />음란성</label>
            <label><input type='radio' name='reason' value='2'/>광고</label>
            <label><input type='radio' name='reason' value='3'/>욕설</label>
            <label><input type='radio' name='reason' value='4'/>도배</label>
            <label><input type='radio' name='reason' value='5'/>저작권 침해</label>
            <label><input type='radio' name='reason' value='6'/>명예훼손</label>
            <label><input type='radio' name='reason' value='0'/>직접 입력</label>
          </div>
          <input type='text' name='reason_text' style='display: none;' placeholder="차단 사유 직접 입력 (한글 20자 이내)"></input>
        </div>
        <div class="block">
          <h3>선택한 글 삭제</h3>
          <input type='checkbox' name='remove'></input>
          <button class="go-block">차단</button>
        </div>
      </div>
    `

    let avoid_hour = 1
    let avoid_reason = 1

    element.querySelector('.close')?.addEventListener('click', _ => {
      closeCallback()
    })

    element.querySelectorAll('input[type="radio"]').forEach(v => {
      v.addEventListener('click', ev => {
        let selected = ev.target as HTMLInputElement

        if (selected!.getAttribute('name') === 'duration') {
          avoid_hour = Number(selected!.value)
        }

        if (selected!.getAttribute('name') === 'reason') {
          let value = Number(selected!.value)

          let blockReasonInput = document.querySelector(
            'input[name="reason_text"]'
          ) as HTMLInputElement

          if (!value) {
            blockReasonInput!.style.display = 'block'
          } else {
            blockReasonInput!.style.display = 'none'
          }

          avoid_reason = value
        }
      })
    })

    element.querySelector('.go-block')?.addEventListener('click', () => {
      let avoid_reason_txt = (element.querySelector(
        'input[name="reason_text"]'
      )! as HTMLInputElement).value
      let del_chk = (element.querySelector(
        'input[name="remove"]'
      )! as HTMLInputElement).checked

      callback(avoid_hour, avoid_reason, avoid_reason_txt, del_chk ? 1 : 0)
    })

    document.querySelector('body')?.appendChild(element)
  },

  admin: (
    preData: GalleryPredata,
    frame: RefresherFrame,
    toggleBlur: boolean,
    eventBus: RefresherEventBus,
    useKeyPress: boolean
  ) => {
    let preFoundBlockElement = document.querySelector('.refresher-block-popup')
    if (preFoundBlockElement) {
      preFoundBlockElement.parentElement?.removeChild(preFoundBlockElement)
    }

    let preFoundElement = document.querySelector('.refresher-management-panel')
    if (preFoundElement) {
      preFoundElement.parentElement?.removeChild(preFoundElement)
    }

    let setAsNotice = !preData.notice
    let setAsRecommend = !preData.recommend

    let element = document.createElement('div')
    element.id = 'refresher-management-panel'
    element.className = 'refresher-management-panel'

    if (toggleBlur) {
      element.className += ' blur'
    }

    let upvoteImage = getURL('/assets/icons/upvote.png')
    let downvoteImage = getURL('/assets/icons/downvote.png')

    element.innerHTML = `
      <div class="button pin">
        <img src="${getURL('/assets/icons/pin.png')}"></img>
        <p>${setAsNotice ? '공지로 등록' : '공지 등록 해제'}</p>
      </div>
      <div class="button recommend">
        <img src="${setAsRecommend ? upvoteImage : downvoteImage}"></img>
        <p>${setAsRecommend ? '개념글 등록' : '개념글 해제'}</p>
      </div>
      <div class="button block">
        <img src="${getURL('/assets/icons/block.png')}"></img>
        <p>차단</p>
      </div>
      <div class="button delete">
        <img src="${getURL('/assets/icons/delete.png')}"></img>
        <p>삭제 (D)</p>
      </div>
    `

    let deleteFunction = () => {
      frame.app.close()

      request.delete(preData).then(response => {
        if (typeof response === 'object') {
          if (response.result === 'success') {
            Toast.show('게시글을 삭제했습니다.', false, 600)
          } else {
            Toast.show(response.message, true, 600)
            alert(`${response.result}: ${response.message}`)
          }

          return
        }

        alert(response)
      })
    }

    element.querySelector('.delete')?.addEventListener('click', deleteFunction)

    if (adminKeyPress) {
      document.removeEventListener('keypress', adminKeyPress)
    }

    if (useKeyPress) {
      adminKeyPress = (ev: KeyboardEvent) => {
        if (ev.code !== 'KeyB' && ev.code !== 'KeyD') {
          return ev
        }

        if (KEY_COUNTS[ev.code]) {
          if (Date.now() - KEY_COUNTS[ev.code][0] > 1000) {
            KEY_COUNTS[ev.code] = [Date.now(), 0]
          }
        } else {
          KEY_COUNTS[ev.code] = [Date.now(), 0]
        }

        KEY_COUNTS[ev.code][0] = Date.now()
        KEY_COUNTS[ev.code][1]++

        if (ev.code === 'KeyD') {
          if (KEY_COUNTS[ev.code][1] >= 2) {
            deleteFunction()
            KEY_COUNTS[ev.code][1] = 0
          } else {
            Toast.show('한번 더 D키를 누르면 게시글을 삭제합니다.', true, 1000)
          }
        }

        // TODO : 차단 프리셋이 지정된 경우 차단

        // else if (ev.code === 'KeyB') {
        //   if (KEY_COUNTS[ev.code][1] > 2) {
        //     // deleteFunction()
        //   } else {
        //     Toast.show('한번 더 B키를 누르면 차단합니다.', true, 1000)
        //   }
        // }
      }
    }

    document.addEventListener('keypress', adminKeyPress)

    element.querySelector('.block')?.addEventListener('click', _ => {
      panel.block(
        (
          avoid_hour: Number,
          avoid_reason: Number,
          avoid_reason_txt: string,
          del_chk: Number
        ) => {
          request
            .block(preData, avoid_hour, avoid_reason, avoid_reason_txt, del_chk)
            .then(response => {
              if (typeof response === 'object') {
                if (response.result === 'success') {
                  alert(response.msg || response.message)

                  if (del_chk) {
                    frame.app.close()
                  }
                } else {
                  alert(`${response.result}: ${response.message}`)
                }

                return
              }

              alert(response)
            })
        },
        () => {
          let blockPopup = document.querySelector('.refresher-block-popup')
          blockPopup!.parentElement?.removeChild(blockPopup!)
        }
      )
    })

    let pin = element.querySelector('.pin')
    pin!.addEventListener('click', _ => {
      request.setNotice(preData, setAsNotice).then(response => {
        eventBus.emit('refreshRequest')

        if (typeof response === 'object') {
          if (response.result === 'success') {
            alert(response.message || response.msg)

            setAsNotice = !setAsNotice
            pin!.querySelector('p')!.innerHTML = setAsNotice
              ? '공지로 등록'
              : '공지 등록 해제'
          } else {
            alert(`${response.result}: ${response.message || response.msg}`)
          }

          return
        }

        alert(response)
      })
    })

    let recommend = element.querySelector('.recommend')
    recommend!.addEventListener('click', _ => {
      request.setRecommend(preData, setAsRecommend).then(response => {
        eventBus.emit('refreshRequest')

        if (typeof response === 'object') {
          if (response.result === 'success') {
            alert(response.message || response.msg)

            setAsRecommend = !setAsRecommend
            recommend!.querySelector('img')!.src = setAsRecommend
              ? upvoteImage
              : downvoteImage
            recommend!.querySelector('p')!.innerHTML = setAsRecommend
              ? '개념글 등록'
              : '개념글 해제'
          } else {
            alert(`${response.result}: ${response.message || response.msg}`)
          }

          return
        }

        alert(response)
      })
    })

    document.querySelector('body')?.appendChild(element)

    return element
  }
}

const getRelevantData = (ev: MouseEvent) => {
  let target = ev.target as HTMLElement
  let isTR = target!.tagName === 'TR'

  let listID = (isTR
    ? target!.querySelector('.gall_num')
    : findNeighbor(target, '.gall_num', 5, null)) as HTMLElement

  let id = ''
  let gallery = ''
  let title = ''
  let link = ''
  let notice = false
  let recommend = false

  let linkElement: HTMLLinkElement

  if (listID) {
    if (listID.innerText === '공지') {
      id =
        new URLSearchParams(
          (isTR
            ? document.querySelector('a')
            : findNeighbor(target, 'a', 5, null)
          )?.getAttribute('href')!
        ).get('no') || ''
      notice = true
    } else {
      id = listID.innerText
    }

    let emElement = isTR
      ? target.querySelector('em.icon_img')
      : findNeighbor(target, 'em.icon_img', 5, null)
    if (emElement) {
      recommend = emElement.className.indexOf('icon_recomimg') > -1
    }

    linkElement = (isTR
      ? target.querySelector('a:not(.reply_numbox)')
      : findNeighbor(
          target,
          'a:not(.reply_numbox)',
          3,
          null
        )) as HTMLLinkElement

    if (typeof linkElement !== null) {
      title = linkElement.innerText
    }
  } else {
    linkElement = (isTR
      ? target.querySelector('a')
      : findNeighbor(ev.target as HTMLElement, 'a', 2, null)) as HTMLLinkElement

    let pt = isTR
      ? target.querySelector('.txt_box')
      : findNeighbor(ev.target as HTMLElement, '.txt_box', 2, null)
    if (pt) {
      title = pt.innerHTML
    }
  }

  if (linkElement) {
    let href = linkElement.href || ''
    let linkNumberMatch = href.match(/\&no=.+/)
    let linkIdMatch = href.match(/\id=.+/)

    if (!linkNumberMatch || !linkIdMatch) {
      return
    }

    id = linkNumberMatch[0].replace('&no=', '').replace(/\&.+/g, '')
    gallery = linkIdMatch[0].replace(/id=/g, '').replace(/\&.+/g, '')
  }

  if (linkElement) {
    link = linkElement.href
  }

  return {
    id,
    gallery,
    title,
    link,
    notice,
    recommend
  }
}

const miniPreview: { [index: string]: any } = {
  element: document.createElement('div'),
  init: false,
  lastRequest: 0,
  controller: new AbortController(),
  lastElement: null,
  create (ev: MouseEvent, use: boolean) {
    if (!use) {
      return
    }

    if (Date.now() - miniPreview.lastRequest < 150) {
      miniPreview.lastRequest = Date.now()
      miniPreview.lastElement = ev.target

      setTimeout(() => {
        if (miniPreview.lastElement === ev.target) {
          miniPreview.create(ev, use)
        }
      }, 150)

      return
    }

    miniPreview.lastRequest = Date.now()

    let preData = getRelevantData(ev)

    if (!preData) {
      return
    }

    if (miniPreview.element.classList.contains('hide')) {
      miniPreview.element.classList.remove('hide')
    }

    if (!miniPreview.element.classList.contains('refresher-mini-preview')) {
      miniPreview.element.classList.add('refresher-mini-preview')
    }

    if (!miniPreview.init) {
      miniPreview.element.innerHTML = `<h3>제목</h3><br><div class="refresher-mini-preview-contents"></div>`

      document.body.appendChild(miniPreview.element)
      miniPreview.init = true
    }

    let selector = miniPreview.element.querySelector(
      '.refresher-mini-preview-contents'
    )

    request
      .post(
        preData.link,
        preData.gallery,
        preData.id,
        miniPreview.controller.signal,
        false
      )
      .then(v => {
        selector!.innerHTML = v.contents

        let writeDiv = selector.querySelector('.write_div')
        if (writeDiv) {
          writeDiv.setAttribute('style', null)
        }
      })
      .catch(e => {
        selector.innerHTML =
          e.message.indexOf('aborted') > -1
            ? ''
            : '게시글을 새로 가져올 수 없습니다: ' + e.message
      })

    miniPreview.element.querySelector('h3')!.innerHTML = preData.title
  },

  move (ev: MouseEvent, use: boolean) {
    if (use) {
      miniPreview.element.style.transform = `translate(${ev.clientX + 20}px, ${ev.clientY}px)`
    }
  },

  close (_: MouseEvent, use: boolean) {
    if (use) {
      miniPreview.controller.abort()
      miniPreview.controller = new AbortController()

      miniPreview.element.classList.add('hide')
    }
  }
}

const request = {
  async vote (
    gall_id: string,
    post_id: string,
    type: string,
    code: string | null,
    link: string
  ) {
    set_cookie_tmp(
      gall_id + post_id + '_Firstcheck' + (!type ? '_down' : ''),
      'Y',
      3,
      'dcinside.com'
    )

    return http
      .make(http.urls.vote, {
        method: 'POST',
        'Sec-Fetch-Site': 'same-origin',
        headers: {
          Origin: 'https://gall.dcinside.com',
          'X-Requested-With': 'XMLHttpRequest',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        cache: 'no-store',
        referrer: link,
        body: `ci_t=${get_cookie('ci_c')}&id=${gall_id}&no=${post_id}&mode=${
          type ? 'U' : 'D'
        }&code_recommend=${code}&_GALLTYPE_=${http.galleryTypeName(
          link
        )}&link_id=${gall_id}`
      })
      .then((v: string) => {
        let res = v.split('||')

        return {
          result: res[0],
          counts: res[1],
          fixedCounts: res[2]
        }
      })
  },

  post (
    link: string,
    gallery: string,
    id: string,
    signal: AbortSignal,
    noCache: boolean
  ) {
    return http
      .make(
        `${http.urls.base +
          http.galleryType(link, '/') +
          http.urls.view +
          gallery}&no=${id}`,
        { signal, cache: noCache ? 'no-cache' : 'default' }
      )
      .then(response => parse(id, response))
  },

  /**
   * 디시인사이드 서버에 댓글을 요청합니다.
   * @param args
   * @param signal
   */
  async comments (args: GalleryHTTPRequestArguments, signal: AbortSignal) {
    if (!args.link) {
      throw new Error('link 값이 주어지지 않았습니다. (확장 프로그램 오류)')
    }

    let galleryType = http.galleryType(args.link, '/')

    let response = await http.make(http.urls.comments, {
      method: 'POST',
      dataType: 'json',
      headers: {
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest'
      },
      cache: 'no-store',
      referrer: `https://gall.dcinside.com/${galleryType}board/view/?id=${args.gallery}&no=${args.id}`,
      body:
        `id=${args.gallery}&no=${Number(args.id)}&cmt_id=${args.commentId ||
          args.gallery}&cmt_no=${Number(args.commentNo || args.id)}&e_s_n_o=${
          (document.getElementById('e_s_n_o')! as HTMLInputElement).value
        }&comment_page=1&sort=&_GALLTYPE_=` + http.galleryTypeName(args.link),
      signal
    })

    return JSON.parse(response)
  },
  async delete (args: GalleryHTTPRequestArguments) {
    if (!args.link) {
      throw new Error('link 값이 주어지지 않았습니다. (확장 프로그램 오류)')
    }

    let galleryType = http.galleryType(args.link, '/')

    let response = await http.make(
      galleryType == 'mini/'
        ? http.urls.manage.deleteMini
        : http.urls.manage.delete,
      {
        method: 'POST',
        dataType: 'json',
        headers: {
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest'
        },
        cache: 'no-store',
        referrer: `https://gall.dcinside.com/${galleryType}board/lists/?id=${args.gallery}`,
        body:
          `ci_t=${get_cookie('ci_c')}&id=${args.gallery}&nos[]=${Number(
            args.id
          )}&_GALLTYPE_=` + http.galleryTypeName(args.link)
      }
    )

    let result

    try {
      result = JSON.parse(response)
    } catch (e) {
      result = response
    }

    return result
  },

  async block (
    args: GalleryHTTPRequestArguments,
    avoid_hour: Number,
    avoid_reason: Number,
    avoid_reason_txt: string,
    del_chk: Number
  ) {
    if (!args.link) {
      throw new Error('link 값이 주어지지 않았습니다. (확장 프로그램 오류)')
    }

    let galleryType = http.galleryType(args.link, '/')

    let response = await http.make(
      galleryType == 'mini/'
        ? http.urls.manage.blockMini
        : http.urls.manage.block,
      {
        method: 'POST',
        dataType: 'json',
        headers: {
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest'
        },
        cache: 'no-store',
        referrer: `https://gall.dcinside.com/${galleryType}board/lists/?id=${args.gallery}`,
        body: `ci_t=${get_cookie('ci_c')}&id=${args.gallery}&nos[]=${Number(
          args.id
        )}&parent=&_GALLTYPE_=${http.galleryTypeName(
          args.link
        )}&avoid_hour=${avoid_hour}&avoid_reason=${avoid_reason}&avoid_reason_txt=${avoid_reason_txt}&del_chk=${del_chk}`
      }
    )

    let result

    try {
      result = JSON.parse(response)
    } catch (e) {
      result = response
    }

    return result
  },

  async setNotice (args: GalleryHTTPRequestArguments, set: boolean) {
    if (!args.link) {
      throw new Error('link 값이 주어지지 않았습니다. (확장 프로그램 오류)')
    }

    let galleryType = http.galleryType(args.link, '/')

    let response = await http.make(
      galleryType == 'mini/'
        ? http.urls.manage.setNoticeMini
        : http.urls.manage.setNotice,
      {
        method: 'POST',
        dataType: 'json',
        headers: {
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest'
        },
        cache: 'no-store',
        referrer: `https://gall.dcinside.com/${galleryType}board/lists/?id=${args.gallery}`,
        body:
          `ci_t=${get_cookie('ci_c')}&mode=${set ? 'SET' : 'REL'}&id=${
            args.gallery
          }&no=${Number(args.id)}&_GALLTYPE_=` + http.galleryTypeName(args.link)
      }
    )

    let result

    try {
      result = JSON.parse(response)
    } catch (e) {
      result = response
    }

    return result
  },

  async setRecommend (args: GalleryHTTPRequestArguments, set: boolean) {
    if (!args.link) {
      throw new Error('link 값이 주어지지 않았습니다. (확장 프로그램 오류)')
    }

    let galleryType = http.galleryType(args.link, '/')

    let response = await http.make(
      galleryType == 'mini/'
        ? http.urls.manage.setRecommendMini
        : http.urls.manage.setRecommend,
      {
        method: 'POST',
        dataType: 'json',
        headers: {
          Accept: 'application/json, text/javascript, */*; q=0.01',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest'
        },
        cache: 'no-store',
        referrer: `https://gall.dcinside.com/${galleryType}board/lists/?id=${args.gallery}`,
        body:
          `ci_t=${get_cookie('ci_c')}&mode=${set ? 'SET' : 'REL'}&id=${
            args.gallery
          }&nos[]=${Number(args.id)}&_GALLTYPE_=` +
          http.galleryTypeName(args.link)
      }
    )

    let result

    try {
      result = JSON.parse(response)
    } catch (e) {
      result = response
    }

    return result
  }
}

let parse = (id: string, body: string) => {
  let dom = new DOMParser().parseFromString(body, 'text/html')

  let header = dom.querySelector('.view_content_wrap span.title_headtext')
    ?.innerHTML

  if (header) {
    header = header.replace(/(\[|\])/g, '')
  }

  let title = dom.querySelector('.view_content_wrap span.title_subject')
    ?.innerHTML

  let date = dom.querySelector('.view_content_wrap div.fl > span.gall_date')
    ?.innerHTML

  let expire = dom.querySelector(
    '.view_content_wrap div.fl > span.mini_autodeltime > div.pop_tipbox > div'
  )?.innerHTML

  if (expire) {
    expire = expire.replace(/\s자동\s삭제/, '')
  }

  let views = dom
    .querySelector('.view_content_wrap div.fr > span.gall_count')
    ?.innerHTML.replace(/조회\s/, '')
  let upvotes = dom
    .querySelector('.view_content_wrap div.fr > span.gall_reply_num')
    ?.innerHTML.replace(/추천\s/, '')

  let downvotes = dom.querySelector('div.btn_recommend_box.clear .down_num')
    ?.innerHTML

  let contents = dom.querySelector(
    '.view_content_wrap > div > div.inner.clear > div.writing_view_box'
  )?.innerHTML

  let commentId = body
    .match(ISSUE_ZOOM_ID)![0]
    .match(QUOTES)![1]
    .replace(/\'/g, '')

  let commentNo = body
    .match(ISSUE_ZOOM_NO)![0]
    .match(QUOTES)![1]
    .replace(/\'/g, '')

  let noticeElement = dom.querySelector(
    '.user_control .option_box li:first-child'
  )
  let isNotice = noticeElement && noticeElement.innerHTML !== '공지 등록'

  return new PostInfo(id, {
    header,
    title,
    date,
    expire,
    user: new User('', '', '', '').import(
      dom.querySelector(
        'div.view_content_wrap > header > div > div.gall_writer'
      ) || null
    ),
    views,
    upvotes,
    downvotes,
    contents,
    commentId,
    commentNo,
    isNotice
  })
}

export default {
  name: '미리보기',
  description: '글을 오른쪽 클릭 했을때 미리보기 창을 만들어줍니다.',
  author: { name: 'Sochiru', url: 'https://sochiru.pw' },
  status: {
    longPressDelay: 300,
    scrollToSkip: true,
    noCacheHeader: false,
    toggleBlur: true,
    toggleAdminPanel: true,
    expandRecognizeRange: false,
    tooltipMode: true,
    useKeyPress: true
  },
  memory: {
    preventOpen: false,
    lastPress: 0,
    uuid: null,
    uuid2: null,
    refreshId: null
  },
  enable: true,
  default_enable: true,
  settings: {
    tooltipMode: {
      name: '툴팁 미리보기 표시',
      desc: '마우스를 올려두면 글 내용만 빠르게 볼 수 있는 툴팁을 추가합니다.',
      default: false,
      type: 'check'
    },
    longPressDelay: {
      name: '기본 마우스 오른쪽 클릭 딜레이',
      desc:
        '마우스 오른쪽 버튼을 해당 밀리초 이상 눌러 뗄 때 기본 우클릭 메뉴가 나오게 합니다.',
      default: 300,
      type: 'range',
      min: 200,
      step: 50,
      max: 2000,
      unit: 'ms'
    },
    scrollToSkip: {
      name: '스크롤하여 게시글 이동',
      desc: '맨 위나 아래로 스크롤하여 다음 게시글로 이동할 수 있게 합니다.',
      default: true,
      type: 'check'
    },
    toggleBlur: {
      name: '배경 블러 활성화',
      desc:
        '미리보기 창의 배경을 블러 처리하여 미관을 돋보이게 합니다. (일부 성능 영향 있음)',
      default: true,
      type: 'check'
    },
    toggleAdminPanel: {
      name: '관리 패널 활성화',
      desc: '갤러리에 관리 권한이 있는 경우 창 옆에 관리 패널을 표시합니다.',
      default: true,
      type: 'check'
    },
    useKeyPress: {
      name: '관리 패널 > 키 제어',
      desc:
        '관리 패널이 활성화된 경우 단축키를 눌러 빠르게 관리할 수 있습니다.',
      default: true,
      type: 'check'
    },
    expandRecognizeRange: {
      name: '게시글 목록 인식 범위 확장',
      desc: '게시글의 오른쪽 클릭을 인식하는 범위를 칸 전체로 확장합니다.',
      default: false,
      type: 'check'
    },
    noCacheHeader: {
      name: 'no-cache 헤더 추가',
      desc: '전송하는 게시글 요청에 no-cache 헤더를 추가합니다.',
      type: 'check',
      default: false,
      advanced: true
    }
  },
  require: ['filter', 'eventBus', 'Frame', 'http', 'block'],
  func (
    filter: RefresherFilter,
    eventBus: RefresherEventBus,
    Frame: RefresherFrame,
    http: RefresherHTTP,
    block: RefresherBlock
  ) {
    let postFetchedData: PostInfo
    let makeFirstFrame = (
      frame: RefresherFrame,
      preData: GalleryPredata,
      signal: AbortSignal
    ) => {
      frame.data.load = true
      frame.title = preData.title || ''
      frame.data.buttons = true

      frame.functions.vote = async (type: string) => {
        let res = await request.vote(
          preData.gallery,
          preData.id,
          type,
          null,
          preData.link || ''
        )

        if (res.result != 'true') {
          alert(res.counts)

          return false
        }

        frame[type ? 'upvotes' : 'downvotes'] = res.counts

        return true
      }

      frame.functions.share = () => {
        if (!window.navigator.clipboard) {
          alert('이 브라우저는 클립보드 복사 기능을 지원하지 않습니다.')
          return false
        }

        window.navigator.clipboard.writeText(
          `https://gall.dcinside.com/${http.galleryType(
            preData.link || ''
          )}/board/view/?id=${preData.gallery || http.queryString('id')}&no=${
            preData.id
          }`
        )

        return true
      }

      frame.functions.load = () => {
        frame.error = false
        frame.data = {}
        frame.data.load = true

        request
          .post(
            preData.link || '',
            preData.gallery || http.queryString('id')!,
            preData.id,
            signal,
            this.status.noCacheHeader
          )
          .then((obj: PostInfo) => {
            if (!obj) {
              return
            }

            postFetchedData = obj

            frame.contents = obj.contents
            frame.upvotes = obj.upvotes
            frame.downvotes = obj.downvotes

            if (frame.title !== obj.title) {
              frame.title = obj.title || ''
            }

            frame.data.user = obj.user
            frame.data.date = new Date(obj.date!.replace(/\./g, '-'))
            frame.data.expire = obj.expire
            frame.data.buttons = true

            eventBus.emit('RefresherPostDataLoaded', obj)
            eventBus.emit(
              'RefresherPostCommentIDLoaded',
              obj.commentId,
              obj.commentNo
            )
            eventBus.emitNextTick('contentPreview', frame.app.$el)

            frame.data.load = false
          })
          .catch((e: Error) => {
            frame.error = {
              title: '게시글',
              detail: e.message || e || '알 수 없는 오류'
            }
            frame.data.load = false
          })
      }

      frame.functions.load()
      frame.functions.retry = frame.functions.load
    }

    let makeSecondFrame = (
      frame: RefresherFrame,
      preData: GalleryPredata,
      signal: AbortSignal
    ) => {
      frame.data.load = true
      frame.title = `댓글`
      frame.subtitle = `로딩 중`

      new Promise<GalleryPredata>((resolve, _) => {
        if (preData.gallery !== 'issuezoom') {
          resolve({
            gallery: preData.gallery,
            id: preData.id
          })

          return
        }

        eventBus.on(
          'RefresherPostCommentIDLoaded',
          (commentId: string, commentNo: string) => {
            resolve({
              gallery: commentId,
              id: commentNo
            })
          },
          {
            once: true
          }
        )

        if (postFetchedData) {
          frame.data.postUserId = postFetchedData.user?.id
        } else {
          eventBus.on(
            'RefresherPostDataLoaded',
            (obj: PostInfo) => {
              frame.data.postUserId = obj.user?.id
            },
            {
              once: true
            }
          )
        }
      }).then(postData => {
        frame.functions.load = () => {
          frame.error = false

          request
            .comments(
              {
                link: preData.link || location.href,
                gallery: preData.gallery,
                id: preData.id,
                commentId: postData.gallery,
                commentNo: postData.id
              },
              signal
            )
            .then((comments: { [index: string]: any }) => {
              if (!comments) {
                frame.error = {
                  detail: 'No comments'
                }
              }

              let threadCounts = 0

              if (comments.comments) {
                comments.comments = comments.comments.filter(
                  (v: { [index: string]: any }) => {
                    return v.nicktype !== 'COMMENT_BOY'
                  }
                )

                comments.comments.map((v: { [index: string]: any }) => {
                  v.user = new User(
                    v.name,
                    v.user_id,
                    v.ip || '',
                    ((new DOMParser()
                      .parseFromString(v.gallog_icon, 'text/html')
                      .querySelector('a.writer_nikcon img') ||
                      {})! as HTMLImageElement).src
                  )
                })

                comments.comments = comments.comments.filter((comment: any) => {
                  return !block.checkAll({
                    NICK: comment.name,
                    ID: comment.user_id,
                    IP: comment.ip
                  })
                })

                threadCounts = comments.comments
                  .map((v: { [index: string]: any }) => Number(v.depth == 0))
                  .reduce((a: number, b: number) => a + b)
              }

              frame.subtitle = `${(comments.total_cnt !== threadCounts &&
                `쓰레드 ${threadCounts}개, 총 댓글`) ||
                ''} ${comments.total_cnt}개`

              frame.data.comments = comments
              frame.data.load = false
            })
            .catch((e: Error) => {
              frame.subtitle = ``

              frame.error = {
                title: '댓글',
                detail: e.message || e || '알 수 없는 오류'
              }
            })
        }

        frame.functions.load()
        frame.functions.retry = frame.functions.load
      })
    }

    let previewFrame = (ev: MouseEvent) => {
      if (this.memory.preventOpen) {
        this.memory.preventOpen = false

        return
      }

      let preData = getRelevantData(ev)

      if (!preData) {
        return
      }

      let controller = new AbortController()
      let { signal } = controller

      let appStore: any
      let groupStore: HTMLElement

      let detector = new ScrollDetection()
      let scrolledCount = 0

      detector.listen('scroll', (ev: WheelEvent) => {
        let scrolledTop = groupStore.scrollTop === 0
        let scrolledToBottom =
          groupStore.scrollHeight - groupStore.scrollTop ===
          groupStore.clientHeight

        if (ev.deltaY < 0) {
          appStore.$data.scrollModeBottom = false
          appStore.$data.scrollModeTop = true

          if (!scrolledTop) {
            appStore.$data.scrollModeTop = false
            appStore.$data.scrollModeBottom = false
          }

          if (!scrolledTop || !preData) {
            return
          }

          if (scrolledCount < 1) {
            scrolledCount++
            return
          }
          scrolledCount = 0

          preData.id = (Number(preData.id) - 1).toString()

          newPostWithData(preData)
          groupStore.scrollTop = 0
          appStore.clearScrollMode()
        } else {
          appStore.$data.scrollModeTop = false
          appStore.$data.scrollModeBottom = true

          if (!scrolledToBottom) {
            appStore.$data.scrollModeTop = false
            appStore.$data.scrollModeBottom = false
          }

          if (!scrolledToBottom || !preData) {
            return
          }

          if (scrolledCount < 1) {
            scrolledCount++
            return
          }
          scrolledCount = 0

          if (!frame.app.first().error) {
            preData.id = (Number(preData.id) + 1).toString()
          }

          newPostWithData(preData)

          groupStore.scrollTop = 0
          appStore.clearScrollMode()
        }
      })

      let frame = new Frame(
        [
          {
            relative: true,
            center: true,
            preview: true,
            blur: this.status.toggleBlur
          },
          {
            relative: true,
            center: true,
            preview: true,
            blur: this.status.toggleBlur
          }
        ],
        {
          background: true,
          stack: true,
          groupOnce: true,
          onScroll: (ev: WheelEvent, app: any, group: HTMLElement) => {
            if (!this.status.scrollToSkip) {
              return
            }

            appStore = app
            groupStore = group

            detector.addMouseEvent(ev)
          }
        }
      )

      let newPostWithData = (preData: GalleryPredata) => {
        let firstApp = frame.app.first()
        let secondApp = frame.app.second()

        if (firstApp.data.load) {
          return
        }

        preData.title = '게시글 로딩 중...'
        firstApp.contents = ''

        makeFirstFrame(firstApp, preData, signal)
        makeSecondFrame(secondApp, preData, signal)

        if (
          this.status.toggleAdminPanel &&
          document.querySelector('.useradmin_btnbox button') !== null
        ) {
          panel.admin(
            preData,
            frame,
            this.status.toggleBlur,
            eventBus,
            this.status.useKeyPress
          )
        }
      }

      frame.app.$on('close', () => {
        controller.abort()

        let blockPopup = document.querySelector('.refresher-block-popup')
        if (blockPopup) {
          blockPopup.parentElement?.removeChild(blockPopup)
        }

        let adminPanel = document.getElementById('refresher-management-panel')
        if (adminPanel) {
          adminPanel.parentElement?.removeChild(adminPanel)
        }

        if (adminKeyPress) {
          document.removeEventListener('keypress', adminKeyPress)
        }
      })

      makeFirstFrame(frame.app.first(), preData, signal)
      makeSecondFrame(frame.app.second(), preData, signal)

      if (
        this.status.toggleAdminPanel &&
        document.querySelector('.useradmin_btnbox button') !== null
      ) {
        panel.admin(
          preData,
          frame,
          this.status.toggleBlur,
          eventBus,
          this.status.useKeyPress
        )
      }

      setTimeout(() => {
        frame.app.fadeIn()
      }, 0)

      ev.preventDefault()
    }

    let handleMousePress = (ev: MouseEvent) => {
      if (ev.button != 2) {
        return ev
      }

      if (ev.type === 'mousedown') {
        this.memory.lastPress = Date.now()
        return ev
      }

      if (
        ev.type === 'mouseup' &&
        this.memory.lastPress &&
        Date.now() - this.status.longPressDelay > this.memory.lastPress
      ) {
        this.memory.preventOpen = true
        this.memory.lastPress = 0
        return ev
      }
    }

    let addHandler = (e: HTMLElement) => {
      e.addEventListener('mouseup', handleMousePress)
      e.addEventListener('mousedown', handleMousePress)
      e.addEventListener('contextmenu', previewFrame)
      e.addEventListener('mouseenter', ev =>
        miniPreview.create(ev, this.status.tooltipMode)
      )
      e.addEventListener('mousemove', ev =>
        miniPreview.move(ev, this.status.tooltipMode)
      )
      e.addEventListener('mouseleave', ev =>
        miniPreview.close(ev, this.status.tooltipMode)
      )
    }

    this.memory.uuid = filter.add(
      `.gall_list .us-post${
        this.status.expandRecognizeRange ? '' : ' .ub-word'
      }`,
      addHandler
    )
    this.memory.uuid2 = filter.add('#right_issuezoom', addHandler)
    this.memory.refreshId = eventBus.on('refresh', (e: HTMLElement) => {
      let elems = e.querySelectorAll(
        `.gall_list .us-post${
          this.status.expandRecognizeRange ? '' : ' .ub-word'
        }`
      )

      let iter = elems.length
      while (iter--) {
        addHandler(elems[iter] as HTMLElement)
      }
    })
  },

  revoke (filter: RefresherFilter, eventBus: RefresherEventBus) {
    if (this.memory.uuid) {
      filter.remove(this.memory.uuid, true)
    }

    if (this.memory.uuid2) {
      filter.remove(this.memory.uuid2, true)
    }

    if (this.memory.refreshId) {
      eventBus.remove('refresh', this.memory.refreshId)
    }
  }
}
