import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Edit, Trash2, PlusCircle, Search, Youtube, Film, BookOpen, Tag, Loader2, Filter, SlidersHorizontal, Grid, List } from 'lucide-react';
import { YouTubeVideo } from '@/types';
import { addYouTubeVideo, updateYouTubeVideo, deleteYouTubeVideo, getYouTubeVideos } from '@/services/firebaseService';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export const ADMIN_UID = 'Ch0V3K1ELxPZyZiC439DrCeAjnM2';

const YouTubeVideoManagement: React.FC = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [allVideos, setAllVideos] = useState<YouTubeVideo[]>([]);
  const [currentVideo, setCurrentVideo] = useState<YouTubeVideo | null>(null);
  const [lastVisibleDoc, setLastVisibleDoc] = useState<any>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreVideos, setHasMoreVideos] = useState(true);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [chapter, setChapter] = useState('');

  const isAdmin = currentUser && currentUser.uid === ADMIN_UID;

  useEffect(() => {
    fetchVideos(true);
  }, []);

  useEffect(() => {
    if (allVideos.length > 0) {
      const chapters = Array.from(new Set(allVideos.map(video => video.chapter)));
      setUniqueChapters(chapters);
    }
  }, [allVideos]);

  useEffect(() => {
    setVideos(allVideos);
  }, [allVideos]);

  const fetchVideos = async (initialLoad = true) => {
    setLoadingMore(true);
    const result = await getYouTubeVideos(10, initialLoad ? null : lastVisibleDoc);
    if (result.success && result.videos) {
      setAllVideos(prevVideos => {
        const newVideos = initialLoad ? result.videos : [...prevVideos, ...result.videos];
        return newVideos;
      });
      if ('lastVisible' in result) {
        setLastVisibleDoc(result.lastVisible);
      }
      setHasMoreVideos(result.videos.length === 10);
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to fetch videos.',
        variant: 'destructive',
      });
    }
    setLoadingMore(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast({
        title: 'Unauthorized',
        description: 'You do not have permission to perform this action.',
        variant: 'destructive',
      });
      return;
    }

    if (!url || !title || !topic || !chapter) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    const videoData = { url, title, topic, chapter };

    let result;
    if (currentVideo) {
      result = await updateYouTubeVideo(currentVideo.id, videoData);
    } else {
      result = await addYouTubeVideo(videoData);
    }

    if (result.success) {
      toast({
        title: 'Success',
        description: `Video ${currentVideo ? 'updated' : 'added'} successfully.`,
      });
      setIsDialogOpen(false);
      resetForm();
      fetchVideos();
    } else {
      toast({
        title: 'Error',
        description: result.error || `Failed to ${currentVideo ? 'update' : 'add'} video.`,
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (video: YouTubeVideo) => {
    setCurrentVideo(video);
    setUrl(video.url);
    setTitle(video.title);
    setTopic(video.topic);
    setChapter(video.chapter);
    setIsDialogOpen(true);
  };

  const handleDelete = async (videoId: string) => {
    if (!isAdmin) {
      toast({
        title: 'Unauthorized',
        description: 'You do not have permission to perform this action.',
        variant: 'destructive',
      });
      return;
    }
    const result = await deleteYouTubeVideo(videoId);
    if (result.success) {
      toast({
        title: 'Success',
        description: 'Video deleted successfully.',
      });
      fetchVideos();
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to delete video.',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setCurrentVideo(null);
    setUrl('');
    setTitle('');
    setTopic('');
    setChapter('');
  };

  // All users can view videos, but only admins can add/edit/delete

  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');
  const [filteredVideos, setFilteredVideos] = useState<YouTubeVideo[]>([]);
  const [showChapters, setShowChapters] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [uniqueChapters, setUniqueChapters] = useState<string[]>([]);

  // Filter videos based on search query
  useEffect(() => {
    let videosToFilter = allVideos;

    if (searchQuery.trim() !== '') {
      videosToFilter = videosToFilter.filter(video => 
        video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        video.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
        video.chapter.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedChapter) {
      videosToFilter = videosToFilter.filter(video => video.chapter === selectedChapter);
    }

    setFilteredVideos(videosToFilter);
  }, [searchQuery, allVideos, selectedChapter]);

  // Extract YouTube video ID from URL
  const getYouTubeVideoId = (url: string): string => {
    if (!url) return '';

    const patterns = [
      /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([^\&\?\n\r#]+)/,
      /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:playlist\?list=)([^\&\?\n\r#]+)/,
      /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:user\/[^\/]+\/|channel\/[^\/]+\/)?videos\/?(?:\?flow=grid&view=0&sort=p&shelf_id=0)?$/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        // Basic validation for video ID length (YouTube video IDs are 11 characters)
        if (match[1].length === 11) {
          return match[1];
        }
      }
    }

    // Fallback for direct video ID or short URLs if regex fails
    const lastSegment = url.split('/').pop();
    if (lastSegment && lastSegment.length === 11) {
      return lastSegment;
    }

    return '';
  };

  return (
    <div className="space-y-6">
      {/* Header with glass morphism effect */}
      <div className="p-6 bg-gradient-to-br from-indigo-900 via-blue-800 to-purple-800 rounded-xl shadow-xl border border-indigo-700/30 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg shadow-lg">
              <Youtube className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">YouTube Video Management</h2>
          </div>
          
          {/* Search bar with animation */}
          <div className="relative w-full md:w-64 group transition-all duration-300 focus-within:w-full md:focus-within:w-80">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="h-4 w-4 text-indigo-300" />
            </div>
            <Input 
              type="search" 
              placeholder="Search videos..." 
              className="pl-10 bg-indigo-950/50 border-indigo-600/30 text-white placeholder:text-indigo-300/70 w-full focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* View mode toggle and add button */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <Tabs defaultValue="grid" className="w-full sm:w-auto" onValueChange={(value) => setViewMode(value as 'table' | 'grid')}>
            <TabsList className="bg-indigo-950/50 border border-indigo-700/30">
              <TabsTrigger value="grid" className="data-[state=active]:bg-indigo-600">
                <div className="flex items-center gap-2">
                  <Film className="h-4 w-4" />
                  <span className="hidden sm:inline">Grid View</span>
                </div>
              </TabsTrigger>
              <TabsTrigger value="table" className="data-[state=active]:bg-indigo-600">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  <span className="hidden sm:inline">Table View</span>
                </div>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          {isAdmin && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  onClick={resetForm} 
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg transition-all duration-300 hover:shadow-xl"
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> Add New Video
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] bg-gradient-to-b from-indigo-950 to-blue-900 text-white border border-indigo-500/30">
                <DialogHeader>
                  <DialogTitle className="text-xl text-white">{currentVideo ? 'Edit Video' : 'Add New Video'}</DialogTitle>
                  <DialogDescription className="text-indigo-200">
                    {currentVideo ? 'Edit the video details.' : 'Add a new YouTube video record here.'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="url" className="text-right text-indigo-100">YouTube URL</Label>
                    <div className="col-span-3 relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <Youtube className="h-4 w-4 text-indigo-300" />
                      </div>
                      <Input 
                        id="url" 
                        value={url} 
                        onChange={(e) => setUrl(e.target.value)} 
                        className="pl-10 bg-indigo-900/50 border-indigo-600/50 text-white" 
                        placeholder="https://youtube.com/watch?v=..." 
                        required 
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="title" className="text-right text-indigo-100">Title</Label>
                    <div className="col-span-3 relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <Film className="h-4 w-4 text-indigo-300" />
                      </div>
                      <Input 
                        id="title" 
                        value={title} 
                        onChange={(e) => setTitle(e.target.value)} 
                        className="pl-10 bg-indigo-900/50 border-indigo-600/50 text-white" 
                        placeholder="Video title" 
                        required 
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="topic" className="text-right text-indigo-100">Topic</Label>
                    <div className="col-span-3 relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <BookOpen className="h-4 w-4 text-indigo-300" />
                      </div>
                      <Input 
                        id="topic" 
                        value={topic} 
                        onChange={(e) => setTopic(e.target.value)} 
                        className="pl-10 bg-indigo-900/50 border-indigo-600/50 text-white" 
                        placeholder="Subject topic" 
                        required 
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="chapter" className="text-right text-indigo-100">Chapter</Label>
                    <div className="col-span-3 relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <Tag className="h-4 w-4 text-indigo-300" />
                      </div>
                      <Input 
                        id="chapter" 
                        value={chapter} 
                        onChange={(e) => setChapter(e.target.value)} 
                        className="pl-10 bg-indigo-900/50 border-indigo-600/50 text-white" 
                        placeholder="Chapter name" 
                        required 
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button 
                      type="submit" 
                      className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
                    >
                      {currentVideo ? 'Save changes' : 'Add Video'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loadingMore && ( 
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
          <span className="ml-2 text-indigo-300">Loading videos...</span>
        </div>
       )}

      {/* Chapter Filter Section */}
      {uniqueChapters.length > 0 && (
        <div className="flex justify-center mt-8">
          {!showChapters && (
            <Button onClick={() => setShowChapters(true)} className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-8 rounded-full shadow-lg transform transition duration-300 ease-in-out hover:scale-105">
              Explore Chapters
            </Button>
          )}

          {showChapters && (
            <div className="flex flex-wrap justify-center gap-4 mt-8 mb-8">
              {uniqueChapters.map(chapter => (
                <Button
                  key={chapter}
                  onClick={() => {
                    setSelectedChapter(chapter);
                    setShowChapters(false); // Hide chapter list after selection
                  }}
                  className={`font-bold py-2 px-6 rounded-full shadow-lg transform transition duration-300 ease-in-out hover:scale-105 ${selectedChapter === chapter ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
                >
                  {chapter}
                </Button>
              ))}
              <Button
                onClick={() => {
                  setSelectedChapter(null);
                  setShowChapters(false);
                }}
                className="font-bold py-2 px-6 rounded-full shadow-lg transform transition duration-300 ease-in-out hover:scale-105 bg-gray-500 hover:bg-gray-600 text-white"
              >
                View All Videos
              </Button>
            </div>
          )}
        </div>
      )}

      {/* No results state */}
      {!loadingMore && filteredVideos.length === 0 && ( 
        <div className="text-center py-12 bg-indigo-950/30 rounded-lg border border-indigo-800/30">
          <Film className="h-12 w-12 text-indigo-400 mx-auto mb-3 opacity-50" />
          <h3 className="text-xl font-medium text-indigo-200 mb-1">No videos found</h3>
          <p className="text-indigo-300">
            {searchQuery ? 'Try a different search term' : 'Add some videos to get started'}
          </p>
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && filteredVideos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVideos.map((video) => (
            <Card key={video.id} className="overflow-hidden bg-indigo-950/40 border-indigo-800/30 hover:border-indigo-600/50 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-900/30 pointer-events-none" onClick={(e) => e.stopPropagation()}>
              <div className="aspect-video w-full overflow-hidden">
                <iframe
                  className="w-full h-full object-cover pointer-events-auto"
                  src={`https://www.youtube.com/embed/${getYouTubeVideoId(video.url)}`}
                  title={video.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  playsInline
                ></iframe>
              </div>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg font-bold text-white line-clamp-1">{video.title}</CardTitle>
                  {isAdmin && (
                    <div className="flex space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(video)} className="h-8 w-8 text-indigo-300 hover:text-white hover:bg-indigo-800/50">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(video.id)} className="h-8 w-8 text-indigo-300 hover:text-white hover:bg-indigo-800/50">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                   )}
                </div>
                <CardDescription className="text-indigo-300">
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge variant="outline" className="bg-indigo-900/50 text-indigo-200 border-indigo-700/50">
                      {video.topic}
                    </Badge>
                    <Badge variant="outline" className="bg-purple-900/50 text-purple-200 border-purple-700/50">
                      {video.chapter}
                    </Badge>
                  </div>
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
          {loadingMore && (
            <div className="flex justify-center items-center py-4 col-span-full">
              <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
              <span className="ml-2 text-indigo-300">Loading more videos...</span>
            </div>
          )}
          {!hasMoreVideos && allVideos.length > 0 && (
            <p className="text-center text-indigo-400 text-sm mt-4 col-span-full">You've reached the end of the video list.</p>
          )}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && filteredVideos.length > 0 && (
        <div className="rounded-lg overflow-hidden border border-indigo-800/30 bg-indigo-950/30">
          <Table>
            <TableHeader className="bg-indigo-900/50">
              <TableRow>
                <TableHead className="text-indigo-100 font-medium">Title</TableHead>
                <TableHead className="text-indigo-100 font-medium">Topic</TableHead>
                <TableHead className="text-indigo-100 font-medium">Chapter</TableHead>
                <TableHead className="text-indigo-100 font-medium">Video</TableHead>
                <TableHead className="text-indigo-100 font-medium text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVideos.map((video) => (
                <TableRow key={video.id} className="border-b border-indigo-800/30 hover:bg-indigo-900/30 transition-colors">
                  <TableCell className="font-medium text-indigo-100">{video.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-indigo-900/50 text-indigo-200 border-indigo-700/50">
                      {video.topic}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-purple-900/50 text-purple-200 border-purple-700/50">
                      {video.chapter}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="w-48 h-28 overflow-hidden rounded-md">
                      <iframe
                        className="w-full h-full object-cover"
                        src={`https://www.youtube.com/embed/${getYouTubeVideoId(video.url)}`}
                        title={video.title}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        playsInline
                      ></iframe>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {isAdmin && (
                      <div className="flex justify-end space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(video)} className="h-8 w-8 text-indigo-300 hover:text-white hover:bg-indigo-800/50">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(video.id)} className="h-8 w-8 text-indigo-300 hover:text-white hover:bg-indigo-800/50">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {loadingMore && (
            <div className="flex justify-center items-center py-4">
              <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
              <span className="ml-2 text-indigo-300">Loading more videos...</span>
            </div>
          )}
          {!hasMoreVideos && allVideos.length > 0 && (
            <p className="text-center text-indigo-400 text-sm mt-4">You've reached the end of the video list.</p>
          )}
        </div>
      )}</div>
    );
  };

  export default YouTubeVideoManagement;