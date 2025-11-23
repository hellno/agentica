'use client';

import React, { Fragment } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { ChevronDown, Check } from 'lucide-react';
import { Room } from '@/lib/platform-api';
import { MorphingSquare } from '@/components/molecule-ui/morphing-square';

interface RoomSelectorProps {
  rooms: Room[];
  currentRoom: Room | null;
  onRoomChange: (room: Room) => void;
  isLoading?: boolean;
}

export default function RoomSelector({
  rooms,
  currentRoom,
  onRoomChange,
  isLoading = false
}: RoomSelectorProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <MorphingSquare className="h-6 w-6 bg-indigo-600" />
        <span className="text-sm text-slate-500">Loading strategies...</span>
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">No strategies yet</span>
      </div>
    );
  }

  return (
    <Listbox value={currentRoom} onChange={onRoomChange}>
      <div className="relative">
        <Listbox.Button className="relative flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
          <div className="flex flex-col text-left">
            <span className="text-xs text-slate-500">Active Strategy</span>
            <span className="text-sm font-semibold text-slate-900">
              {currentRoom?.name || 'Select strategy'}
            </span>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-600" />
        </Listbox.Button>

        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <Listbox.Options className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50 max-h-80 overflow-auto">
            {rooms.map((room) => (
              <Listbox.Option
                key={room.id}
                value={room}
                className={({ active }) =>
                  `relative cursor-pointer select-none py-3 px-4 ${
                    active ? 'bg-indigo-50' : ''
                  }`
                }
              >
                {({ selected }) => (
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm font-semibold ${selected ? 'text-indigo-600' : 'text-slate-900'}`}>
                          {room.name}
                        </span>
                        {selected && (
                          <Check className="w-4 h-4 text-indigo-600" />
                        )}
                      </div>
                      {room.description && (
                        <p className="text-xs text-slate-500 line-clamp-2">
                          {room.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          room.status === 'active' ? 'bg-green-100 text-green-800' :
                          room.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {room.status}
                        </span>
                        <span className="text-xs text-slate-400">
                          {room.frequency}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </Transition>
      </div>
    </Listbox>
  );
}
