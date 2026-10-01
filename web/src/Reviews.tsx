import { useEffect, useRef, useState } from 'react';
import { validateReview, type ReviewList } from '../../shared/reviews';
import { useAccount } from './AccountContext';
import { listReviews, reviewAction, reviewPhotoAction, uploadReviewPhoto } from './reviews-api';
import { prepareReviewPhoto } from './review-photo';
import { useOnline } from './useOnline';
export default function Reviews({ placeId }: { placeId: string }) {
  const account = useAccount(); const online = useOnline();
  const [data, setData] = useState<ReviewList | null>(null); const [rating, setRating] = useState(5); const [text, setText] = useState('');
  const [message, setMessage] = useState(''); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [photoBusy, setPhotoBusy] = useState(false); const [photoMessage, setPhotoMessage] = useState(''); const [photoActionId, setPhotoActionId] = useState(''); const [reload, setReload] = useState(0);
  const mutation = useRef<AbortController | null>(null); const locked = useRef(false);
  const draftKey = `${placeId}:${account.user?.id ?? ''}:${reload}`;
  const previousDraftKey = useRef('');
  const loadedDraftKey = useRef('');
  useEffect(() => {
    const resetDraft = previousDraftKey.current !== draftKey; previousDraftKey.current = draftKey;
    const controller = new AbortController(); mutation.current?.abort(); locked.current = false; setBusy(false); setData(null); setLoading(true); setMessage(''); if (resetDraft) { setText(''); setRating(5); }
    if (!online) { setLoading(false); setMessage('Reviews need a connection. No review is queued or sent offline.'); return () => controller.abort(); }
    listReviews(placeId,controller.signal).then(result => { if (!controller.signal.aborted) { setData(result); if (loadedDraftKey.current !== draftKey) { loadedDraftKey.current = draftKey; if (result.mine) { setText(result.mine.text); setRating(result.mine.rating); } } } }).catch(error => { if (!controller.signal.aborted) setMessage((error as Error).message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); mutation.current?.abort(); };
  }, [placeId,draftKey,online]);
  async function change(action: 'save' | 'remove' | 'report', id?: string) {
    if (locked.current) return;
    if (!account.user || account.cached) { account.setOpen(true); return; }
    const controller = new AbortController(); mutation.current = controller; locked.current = true; setBusy(true); setMessage('');
    try {
      await reviewAction(action === 'save' ? { action, placeId, rating, text } : { action, id: id! },controller.signal);
      const result = await listReviews(placeId,controller.signal);
      if (!controller.signal.aborted) { setData(result); if (action === 'remove') setText(''); setMessage(action === 'report' ? 'Report received. Hidden reviews are excluded from ratings.' : action === 'remove' ? 'Your review was removed.' : 'Review saved. Thanks for the honest detour notes!'); }
    } catch (error) { if (!controller.signal.aborted) setMessage('Change not confirmed. Retry is safe. ' + (error as Error).message); }
    finally { if (!controller.signal.aborted) { locked.current = false; setBusy(false); } }
  }
  async function addPhotos(event: React.ChangeEvent<HTMLInputElement>) {
    const input=event.currentTarget, selected=Array.from(input.files||[]); input.value='';
    if (photoBusy || !data?.mine || data.mine.status!=='visible' || !selected.length) return;
    const remaining=Math.max(0,3-data.mine.photos.length);
    if (!remaining) { setPhotoMessage('This review already has three photos.'); return; }
    setPhotoBusy(true); setPhotoMessage('Preparing your photo…'); let uploaded=0;
    try {
      if (selected.length>remaining) setPhotoMessage(`Only ${remaining} more photo${remaining===1?'':'s'} fit this review.`);
      for (const file of selected.slice(0,remaining)) { const photo=await prepareReviewPhoto(file); await uploadReviewPhoto(data.mine.id,photo); uploaded++; setPhotoMessage('Photo sent for moderator review.'); }
      const result=await listReviews(placeId); setData(result);
      setPhotoMessage(uploaded===1?'Photo sent for moderator review.':`${uploaded} photos sent for moderator review.`);
    } catch (error) { setPhotoMessage(`${uploaded ? `${uploaded} photo${uploaded===1?'':'s'} uploaded; ` : ''}${(error as Error).message}`); }
    finally { setPhotoBusy(false); }
  }
  async function managePhoto(action:'remove'|'report',id:string) {
    if (photoBusy || photoActionId) return;
    if (!account.user || account.cached) { account.setOpen(true); return; }
    setPhotoActionId(id); setPhotoMessage('');
    try { await reviewPhotoAction(action,id); setData(await listReviews(placeId)); setPhotoMessage(action==='remove'?'Your photo was removed.':'Thanks. The photo is queued for review if it reaches the report threshold.'); }
    catch(error) { setPhotoMessage((error as Error).message); }
    finally { setPhotoActionId(''); }
  }
  const canWrite = online && !!account.user && !account.cached && !busy && !photoBusy && !loading && !!data;
  let validDraft = false;
  try { validateReview({ placeId, rating, text }); validDraft = true; } catch { /* The shared Unicode limits also govern the editor. */ }
  return <section className="spot-reviews" aria-label="SPOTLAND community reviews"><h3>Traveller notes</h3><p className="location-note">SPOTLAND reviews only. Visits are not verified. Post photos you have permission to share; avoid private details, contact numbers and identifiable children. Photos stay hidden until a moderator approves them. Three distinct reports hide a review or photo.</p>
    {loading ? <p role="status">Loading traveller notes…</p> : data && <><p>{data.average === null ? 'No ratings yet.' : `${data.average} / 5 · ${data.count} community review${data.count === 1 ? '' : 's'}`}</p><p className="location-note">Showing the latest 20 visible reviews. The average includes all visible reviews.</p><ul className="review-list">{data.reviews.map(review => <li key={review.id}><strong>{review.rating} / 5 · Traveller</strong><p className="review-text">{review.text}</p>{!!review.photos?.length && <div className="review-photos">{review.photos.map(photo=><figure key={photo.id}><img src={photo.url} alt="Photo shared with this traveller review" loading="lazy"/><figcaption>Traveller photo</figcaption></figure>)}</div>}{data.mine?.id !== review.id && <>{review.photos?.map(photo=><button key={`report:${photo.id}`} disabled={!canWrite || photoActionId===photo.id} onClick={()=>void managePhoto('report',photo.id)}>Report photo</button>)}<button disabled={!canWrite} onClick={() => void change('report',review.id)}>Report this review</button></>}<small>{new Date(review.updatedAt).toLocaleDateString('en-IN')}{review.updatedAt !== review.createdAt ? ' · edited' : ''}</small></li>)}</ul></>}
    <p role="status">{message}</p><button disabled={!online || busy || loading} onClick={() => setReload(value => value + 1)}>Refresh reviews (resets draft)</button>
    {!account.user || account.cached ? <button disabled={!online} onClick={() => account.setOpen(true)}>Sign in to write or report a review</button> : data?.mine?.status === 'hidden' ? <><p>Your review is hidden for moderation. Editing is unavailable.</p><button disabled={!canWrite} onClick={() => void change('remove',data.mine!.id)}>Remove my review</button></> : <><details><summary>{data?.mine ? 'Edit your review' : 'Leave a little note'}</summary><p>One review per account per place. 10–1000 characters; up to 10 publishes/edits daily, at least 30 seconds apart. Text stays in this screen’s memory until you leave or refresh.</p><form className="event-form" onSubmit={event => { event.preventDefault(); void change('save'); }}><label>Rating<select value={rating} onChange={event => setRating(Number(event.target.value))}>{[5,4,3,2,1].map(value => <option key={value} value={value}>{value} / 5</option>)}</select></label><label>Your review<textarea required maxLength={2000} value={text} onChange={event => setText(event.target.value)}/></label><p className="location-note">{[...text].length} / 1000 characters</p><button disabled={!canWrite || !validDraft}>Save review</button>{data?.mine && <button type="button" disabled={!canWrite} onClick={() => void change('remove',data.mine!.id)}>Remove my review</button>}</form></details>
      {data?.mine?.status==='visible' ? <div className="review-photo-upload"><h4>Your review photos</h4><p>Up to three per review · JPEG, PNG or WebP · compressed to under 3 MB · approval required before public display.</p>{data.mine.photos.map(photo=><div className="review-photo-owner" key={photo.id}>{photo.url&&<img src={photo.url} alt="Your approved review photo" loading="lazy"/>}<span>{photo.status==='pending'?'Waiting for moderator approval':photo.status==='hidden'?'Hidden from public view':'Approved'}</span><button type="button" disabled={!online||photoBusy||!!photoActionId} onClick={()=>void managePhoto('remove',photo.id)}>Remove photo</button></div>)}<label>Add photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={!online||!data.mine||data.mine.photos.length>=3||photoBusy} onChange={event=>void addPhotos(event)}/></label><p role="status">{photoBusy?'Preparing and uploading…':photoMessage}</p></div> : data?.mine ? <p>Your review photos are unavailable while the review is hidden.</p> : <p>Save a review first; then you can add up to three photos.</p>}</>}
  </section>;
}
