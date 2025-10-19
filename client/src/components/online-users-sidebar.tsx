import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import type { OnlinePresence } from "@shared/schema";

interface OnlineUsersSidebarProps {
  presence?: OnlinePresence;
}

export function OnlineUsersSidebar({ presence }: OnlineUsersSidebarProps) {
  return (
    <Card className="h-full border-l border-t-0 border-r-0 border-b-0 rounded-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4" />
          Online Now
          <Badge variant="secondary" className="ml-auto">
            {presence?.roundedCount || '0'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-2">
            {/* Placeholder for actual user list - showing online indicator */}
            <div className="text-sm text-muted-foreground text-center py-8">
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="font-medium text-foreground">
                    {presence?.roundedCount || '0'} humans
                  </div>
                  <div className="text-xs">chatting right now</div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
