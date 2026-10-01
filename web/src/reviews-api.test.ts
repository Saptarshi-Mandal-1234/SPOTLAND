import { afterEach, expect, it, vi } from 'vitest';
import { hideReview, listReviews, moderateReviewPhoto, moderatedReviewPhotos, moderatedReviews, reviewAction, reviewPhotoAction, uploadReviewPhoto } from './reviews-api';
afterEach(() => vi.unstubAllGlobals());
it('encodes places, uses same-origin cookies and sends only the chosen mutation', async () => {
  const fetcher=vi.fn().mockImplementation(() => Promise.resolve(Response.json({reviews:[],count:0,average:null,mine:null}))); vi.stubGlobal('fetch',fetcher);
  await listReviews('node/1'); expect(fetcher.mock.calls[0][0]).toContain('placeId=node%2F1'); expect(fetcher.mock.calls[0][1].credentials).toBe('same-origin');
  await reviewAction({action:'report',id:'test'}); expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({action:'report',id:'test'});
});
it('does not send cancelled requests and surfaces server failures', async () => {
  const fetcher=vi.fn().mockResolvedValue(Response.json({error:'Wait 30 seconds.'},{status:429})); vi.stubGlobal('fetch',fetcher);
  const controller=new AbortController();const pending=listReviews('node/1',controller.signal);controller.abort(); await expect(pending).rejects.toThrow(); expect(fetcher).not.toHaveBeenCalled();
  await expect(reviewAction({action:'save',placeId:'node/1',rating:5,text:'Nice public place.'})).rejects.toThrow('Wait 30 seconds.');
});
it('limits moderator APIs to the requested read and hide actions with a bearer token', async () => {
  const fetcher=vi.fn().mockImplementation(() => Promise.resolve(Response.json([]))); vi.stubGlobal('fetch',fetcher);
  await moderatedReviews('fixture-moderator-token');
  expect(fetcher.mock.calls[0][0]).toBe('/api/admin/reviews');
  expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer fixture-moderator-token');
  await hideReview('review-id','fixture-moderator-token');
  expect(fetcher.mock.calls[1][1].method).toBe('POST');
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({action:'hide',id:'review-id'});
});
it('uploads compressed images as multipart data and uses protected review-photo moderation routes', async()=>{
  const fetcher=vi.fn().mockImplementation(()=>Promise.resolve(Response.json({id:'photo-id',status:'pending'})));vi.stubGlobal('fetch',fetcher);
  const image=new File([new Uint8Array([1,2,3])],'review.jpg',{type:'image/jpeg'});
  await uploadReviewPhoto('review-id',image);
  expect(fetcher.mock.calls[0][0]).toBe('/api/review-photos');
  expect(fetcher.mock.calls[0][1].credentials).toBe('same-origin');
  expect(fetcher.mock.calls[0][1].body.get('reviewId')).toBe('review-id');
  expect(fetcher.mock.calls[0][1].body.get('photo').type).toBe('image/jpeg');
  await reviewPhotoAction('report','photo-id');
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({action:'report',id:'photo-id'});
  fetcher.mockResolvedValueOnce(Response.json([]));
  await moderatedReviewPhotos('fixture-moderator-token');
  expect(fetcher.mock.calls[2][0]).toBe('/api/admin/review-photos');
  expect(fetcher.mock.calls[2][1].headers.Authorization).toBe('Bearer fixture-moderator-token');
  await moderateReviewPhoto('photo-id','approve','fixture-moderator-token');
  expect(JSON.parse(fetcher.mock.calls[3][1].body)).toEqual({id:'photo-id',action:'approve'});
});

