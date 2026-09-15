import type { Metadata } from 'next'
import { LegalDocument, type LegalSection } from '@/components/legal-document'

export const metadata: Metadata = {
  title: '隐私政策 · L2CL AccessHub',
  description: '了解 L2CL AccessHub 如何收集、使用、保存和保护个人信息。',
}

const sections: LegalSection[] = [
  {
    id: 'scope',
    title: '适用范围与运营者',
    content: <><p>本政策适用于 L2CL AccessHub（以下简称“本服务”）的网站、API 权益控制台、兑换功能以及爱发电账号绑定和订单权益处理功能。</p><p>本服务由 L2CL 项目运营者提供。如需提出隐私问题或行使数据权利，可通过 <a href="https://afdian.com/a/lc-cn" target="_blank" rel="noreferrer">爱发电主页私信</a>或 <a href="https://github.com/lc-cn/l2cl/issues" target="_blank" rel="noreferrer">GitHub Issues</a> 联系我们。请勿在公开 Issue 中提交密码、访问令牌、订单详情或其他敏感信息。</p></>,
  },
  {
    id: 'collection',
    title: '我们处理的信息',
    content: <><p>我们仅在提供和保护本服务所需的范围内处理以下信息：</p><ul><li><strong>账户信息：</strong>通过 GitHub OAuth 获得的账户标识、用户名或显示名称、邮箱地址、头像，以及登录会话所需的数据。</li><li><strong>设备与安全信息：</strong>登录时间、会话有效期、IP 地址、浏览器或 User-Agent，以及防止滥用和排查故障所需的安全记录。</li><li><strong>服务与用量信息：</strong>所属订阅计划、API 调用计数、限速窗口、日/周/月用量、Credits 余额和权益有效期。除非具体 API 另有说明，我们不会为用量统计保存你的 API 请求正文。</li><li><strong>兑换与订单信息：</strong>兑换码状态、权益发放记录，以及爱发电提供的用户标识、订单号、方案或 SKU、金额、购买周期和订单状态。爱发电订单回调在特定商品场景下还可能包含留言、联系方式或收货信息。</li><li><strong>分析信息：</strong>页面访问和基础性能数据，用于了解服务是否正常运行和改进界面。</li></ul></>,
  },
  {
    id: 'purpose',
    title: '处理目的与依据',
    content: <ul><li>创建账户、完成身份验证并维持登录状态。</li><li>执行 API 限速、用量统计、订阅计划与 Credits 权益。</li><li>验证兑换码和爱发电订单，发放、续期或恢复已购买权益。</li><li>防止欺诈、共享凭据、自动化滥用和其他危害服务安全的行为。</li><li>排查故障、衡量服务质量、回应咨询并履行适用的法律义务。</li></ul>,
  },
  {
    id: 'oauth',
    title: '第三方登录与爱发电绑定',
    content: <><p>GitHub OAuth 用于首次注册和登录。本服务不会因登录而读取你的私有仓库内容。你应同时查阅 GitHub 的隐私规则。</p><p>当你主动绑定爱发电后，我们会保存授权返回的爱发电用户标识，用于后续登录，并把支付订单与 AccessHub 账户关联。OAuth 客户端密钥仅保存在服务端，不会发送到浏览器。你可以联系我们解除绑定；解除绑定不会自动删除为履行订单或防止重复发放而必须保留的记录。</p></>,
  },
  {
    id: 'sharing',
    title: '委托处理、共享与跨境',
    content: <><p>我们不会出售个人信息。为运行本服务，信息可能由以下服务提供方处理：Vercel（网站托管和基础分析）、数据库托管服务、GitHub（身份验证）以及爱发电（授权、支付和订单通知）。</p><p>这些提供方可能在你所在地区以外处理数据。我们会尽量选择具有合理安全措施的服务，并将处理范围限制在实现相应功能所需的程度。支付信息由爱发电及其支付渠道处理，本服务不会保存完整银行卡或第三方支付账户凭据。</p></>,
  },
  {
    id: 'cookies',
    title: 'Cookie 与本地存储',
    content: <p>本服务使用必要的会话 Cookie 维持登录状态并保护账户安全。禁用必要 Cookie 可能导致无法登录或使用控制台。若未来增加非必要 Cookie，我们会在启用前提供相应说明或选择。</p>,
  },
  {
    id: 'retention',
    title: '保存期限与安全',
    content: <><p>我们仅在实现上述目的所必需的期限内保存信息。登录会话在过期或注销后失效；账户、订单、兑换和安全记录可能在账户使用期间以及处理争议、防止重复发放或履行法律义务所需的合理期限内保留。超过必要期限后，我们将删除、匿名化或停止除安全存储以外的处理。</p><p>我们采用 HTTPS、服务端密钥、访问控制、数据库权限和订单幂等校验等措施降低数据风险。但任何互联网服务都无法保证绝对安全，请勿共享账户、兑换码或 API 凭据。</p></>,
  },
  {
    id: 'rights',
    title: '你的选择与权利',
    content: <><p>在适用法律规定的范围内，你可以请求访问、更正、复制或删除个人信息，撤回授权、解除爱发电绑定，或对处理活动提出问题。为保护账户，我们可能要求你先验证身份。</p><p>删除账户或撤回授权可能使部分功能不可用。法律要求保留、处理争议、安全审计或防止重复兑现所必需的信息，可能无法立即删除。</p></>,
  },
  {
    id: 'children',
    title: '未成年人',
    content: <p>本服务主要面向具备相应民事行为能力的开发者和 API 使用者。未成年人应在监护人同意和指导下使用本服务及购买权益。如发现未经适当同意处理了未成年人信息，请联系我们。</p>,
  },
  {
    id: 'updates',
    title: '政策更新',
    content: <p>当功能、处理方式或法律要求发生重要变化时，我们会更新本政策，并在页面顶部标注更新日期。若变化对你的权利产生重大影响，我们会通过站内提示或其他合理方式通知。</p>,
  },
]

export default function PrivacyPage() {
  return <LegalDocument eyebrow="PRIVACY & DATA" title="隐私政策" summary="我们希望用清楚、可核对的方式说明：AccessHub 为什么需要这些数据、数据如何流转，以及你可以如何控制它们。" sections={sections}/>
}
